import React, { useState, useEffect } from 'react';
import { MapPin, Clock, LogIn, LogOut, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUser } from '../contexts/UserContext';
import { AttendanceRecord, CompanySettings, RemoteWorkRequest } from '../types';
import { format } from 'date-fns';
import { cn } from '../lib/utils';
import { isWithinRadius } from '../lib/locationUtils';
import { Shield, ShieldAlert, Globe, Camera } from 'lucide-react';
import { FaceVerification } from './FaceVerification';

export function AttendanceWidget() {
  const { user } = useUser();
  const [record, setRecord] = useState<AttendanceRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'capturing' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [isRemoteAuthorized, setIsRemoteAuthorized] = useState(false);
  const [isInsideOffice, setIsInsideOffice] = useState<boolean | null>(null);
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceMode, setFaceMode] = useState<'register' | 'verify'>('verify');
  const [nextAction, setNextAction] = useState<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (user?.employeeId) {
      fetchTodayRecord();
      fetchSettingsAndAuth();
    }
  }, [user]);

  const fetchSettingsAndAuth = async () => {
    try {
      // Fetch company settings
      const { data: settingsData } = await supabase
        .from('company_settings')
        .select('*')
        .single();
      
      if (settingsData) setSettings(settingsData as CompanySettings);

      // Fetch today's remote work authorization
      const today = new Date().toISOString().slice(0, 10);
      const { data: authData } = await supabase
        .from('remote_work_requests')
        .select('*')
        .eq('employee_id', user?.employeeId)
        .eq('date', today)
        .eq('status', 'Approved')
        .maybeSingle();

      if (authData) setIsRemoteAuthorized(true);
    } catch (err) {
      console.error('Error fetching settings/auth:', err);
    }
  };

  const fetchTodayRecord = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employeeId', user?.employeeId)
      .eq('date', today)
      .maybeSingle();

    if (error) console.error('Error fetching attendance:', error);
    setRecord(data as AttendanceRecord);
    setLoading(false);
  };

  const getPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  };

  const handleClockIn = async () => {
    if (!user?.employeeId) return;
    
    // Require Face Verification if descriptor exists
    if (user.faceDescriptor && !showFaceModal) {
      setFaceMode('verify');
      setNextAction(() => handleClockIn);
      setShowFaceModal(true);
      return;
    }

    setActionLoading(true);
    setLocationStatus('capturing');
    setError(null);

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;
      
      // Geofencing Check
      let inside = false;
      if (settings) {
        inside = isWithinRadius(
          latitude, 
          longitude, 
          settings.office_lat, 
          settings.office_lng, 
          settings.office_radius_meters
        );
        setIsInsideOffice(inside);
      }

      if (!inside && !isRemoteAuthorized) {
        throw new Error('You are outside the office radius and do not have an approved remote work authorization for today.');
      }

      setLocationStatus('success');

      const now = new Date();
      const checkInTime = format(now, 'HH:mm');
      const standardTime = new Date(now.setHours(9, 0, 0, 0));
      const status = new Date() > standardTime ? 'Late' : 'Present';

      const { error: insertError } = await supabase.from('attendance').insert({
        id: crypto.randomUUID(),
        employeeId: user.employeeId,
        date: format(new Date(), 'yyyy-MM-dd'),
        checkIn: checkInTime,
        status: status,
        checkInLat: latitude,
        checkInLng: longitude,
      });

      if (insertError) throw insertError;
      await fetchTodayRecord();
      setShowFaceModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to capture location. Please ensure GPS is enabled.');
      setLocationStatus('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!record?.id) return;

    // Require Face Verification if descriptor exists
    if (user?.faceDescriptor && !showFaceModal) {
      setFaceMode('verify');
      setNextAction(() => handleClockOut);
      setShowFaceModal(true);
      return;
    }

    setActionLoading(true);
    setLocationStatus('capturing');
    setError(null);

    try {
      const position = await getPosition();
      const { latitude, longitude } = position.coords;

      // Geofencing Check
      let inside = false;
      if (settings) {
        inside = isWithinRadius(
          latitude, 
          longitude, 
          settings.office_lat, 
          settings.office_lng, 
          settings.office_radius_meters
        );
        setIsInsideOffice(inside);
      }

      if (!inside && !isRemoteAuthorized) {
        throw new Error('You are outside the office radius and do not have an approved remote work authorization for today.');
      }

      setLocationStatus('success');

      const checkOutTime = format(new Date(), 'HH:mm');

      const { error: updateError } = await supabase
        .from('attendance')
        .update({
          checkOut: checkOutTime,
          checkOutLat: latitude,
          checkOutLng: longitude,
        })
        .eq('id', record.id);

      if (updateError) throw updateError;
      await fetchTodayRecord();
      setShowFaceModal(false);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to capture location. Please ensure GPS is enabled.');
      setLocationStatus('error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegisterFace = async (descriptor: string) => {
    if (!user?.employeeId) return;
    
    try {
      const { error } = await supabase
        .from('employees')
        .update({ face_descriptor: descriptor })
        .eq('id', user.employeeId);
      
      if (error) throw error;
      
      // We might need to refresh the user context or just notify them
      // In this demo, we'll assume the user will see the change on next load or we could add a state
      alert('Face ID registered successfully!');
      window.location.reload(); // Simple way to refresh context for now
    } catch (err) {
      console.error('Error registering face:', err);
      alert('Failed to save Face ID.');
    }
  };

  if (loading) return null;

  const isClockedIn = record && record.checkIn && record.checkIn !== '-';
  const isClockedOut = record && record.checkOut && record.checkOut !== '-';

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Work Attendance</h3>
          <p className="text-sm text-gray-500">Record your daily check-in with GPS verification.</p>
        </div>
        <div className={cn(
          "p-3 rounded-xl",
          isClockedOut ? "bg-emerald-50 text-emerald-600" :
          isClockedIn ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600"
        )}>
          {isClockedOut ? <CheckCircle2 className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Check In</p>
          <p className="text-xl font-bold text-gray-900">{record?.checkIn || '--:--'}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Check Out</p>
          <p className="text-xl font-bold text-gray-900">{record?.checkOut || '--:--'}</p>
        </div>
      </div>

      <div className="space-y-3">
        {!isClockedIn ? (
          <button
            onClick={handleClockIn}
            disabled={actionLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2 group"
          >
            <LogIn className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            {actionLoading ? 'Capturing GPS...' : 'Clock In Now'}
          </button>
        ) : !isClockedOut ? (
          <button
            onClick={handleClockOut}
            disabled={actionLoading}
            className="w-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2 group"
          >
            <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            {actionLoading ? 'Capturing GPS...' : 'Clock Out Now'}
          </button>
        ) : (
          <div className="w-full bg-emerald-50 text-emerald-700 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
            Attendance Completed
          </div>
        )}

        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-medium">
              <MapPin className={cn(
                "w-3.5 h-3.5",
                locationStatus === 'success' ? "text-emerald-500" :
                locationStatus === 'error' ? "text-red-500" :
                locationStatus === 'capturing' ? "text-blue-500 animate-pulse" : "text-gray-400"
              )} />
              <span className={cn(
                locationStatus === 'success' ? "text-emerald-600" :
                locationStatus === 'error' ? "text-red-600" :
                locationStatus === 'capturing' ? "text-blue-600" : "text-gray-500"
              )}>
                {locationStatus === 'capturing' ? 'Capturing GPS coordinates...' :
                 locationStatus === 'success' ? 'GPS Location Captured' :
                 locationStatus === 'error' ? 'Location Access Denied' : 'GPS verification enabled'}
              </span>
            </div>
            
            {isRemoteAuthorized && !isClockedOut && (
              <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                <Globe className="w-2.5 h-2.5" />
                Remote Work Authorized
              </div>
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">{format(new Date(), 'EEE, MMM d')}</span>
        </div>
      </div>

      {isInsideOffice === false && !isRemoteAuthorized && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <p>You are outside the office radius. Remote clock-in requires HR authorization.</p>
        </div>
      )}

      {!user?.faceDescriptor && (
        <div className="mt-4 p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm border border-blue-50">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-900">Enable Face ID</p>
              <p className="text-[11px] text-blue-700">Improve attendance accuracy with facial recognition.</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setFaceMode('register');
              setShowFaceModal(true);
            }}
            className="px-3 py-1.5 bg-blue-600 text-white text-[11px] font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            Register Now
          </button>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-medium">
          {error}
        </div>
      )}

      {/* Face Verification Modal */}
      <FaceVerification 
        isOpen={showFaceModal}
        onClose={() => {
          setShowFaceModal(false);
          setActionLoading(false);
          setLocationStatus('idle');
        }}
        mode={faceMode}
        expectedDescriptor={user?.faceDescriptor}
        onVerified={() => {
          if (faceMode === 'verify') {
             if (nextAction) nextAction();
          } else {
            setShowFaceModal(false);
          }
        }}
        onDescriptorGenerated={handleRegisterFace}
      />
    </div>
  );
}
