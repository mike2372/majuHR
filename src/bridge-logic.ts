import { supabase } from './lib/supabase';

// Dashboard data interface
interface DashboardData {
  employeeCount: number;
  activeCount: number;
  totalPayroll: number;
  attendanceRate: number;
}

// Message interface for Android bridge
interface BridgeMessage {
  type: string;
  data?: DashboardData;
  error?: string;
}

// Declare AndroidBridge interface for TypeScript
declare global {
  interface Window {
    AndroidBridge?: {
      postMessage: (json: string) => void;
    };
    onBridgeReady?: () => void;
    fetchDashboardData?: () => Promise<void>;
    handleOAuthCallback?: (accessToken: string, refreshToken: string) => void;
    handleOAuthError?: (error: string) => void;
  }
}

/**
 * Fetch dashboard data from Supabase and send to Android
 */
async function fetchDashboardData(): Promise<void> {
  try {
    // Fetch employee data
    const { data: employees, error: employeeError } = await supabase
      .from('employees')
      .select('*');

    if (employeeError) {
      throw new Error(`Employee fetch error: ${employeeError.message}`);
    }

    const employeeCount = employees?.length || 0;
    const activeCount = employees?.filter((e: any) => e.status === 'Active').length || 0;

    // Fetch payroll data
    const { data: payroll, error: payrollError } = await supabase
      .from('payroll')
      .select('*');

    if (payrollError) {
      throw new Error(`Payroll fetch error: ${payrollError.message}`);
    }

    const totalPayroll = payroll?.reduce((acc: number, doc: any) => acc + (doc.net_salary || 0), 0) || 0;

    // Fetch today's attendance (simplified - in production you'd calculate actual rate)
    const today = new Date().toISOString().slice(0, 10);
    const { data: attendance, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .eq('date', today)
      .eq('status', 'Present');

    // Calculate attendance rate (present / total employees)
    const attendanceRate = employeeCount > 0
      ? (attendance?.length || 0) / employeeCount
      : 0.95; // Default to 95% if no data

    const dashboardData: DashboardData = {
      employeeCount,
      activeCount,
      totalPayroll,
      attendanceRate
    };

    // Send data to Android
    const message: BridgeMessage = {
      type: 'DASHBOARD_DATA',
      data: dashboardData
    };

    if (window.AndroidBridge) {
      window.AndroidBridge.postMessage(JSON.stringify(message));
    } else {
      console.log('Dashboard data (no Android bridge):', dashboardData);
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);

    // Send error to Android
    const message: BridgeMessage = {
      type: 'DASHBOARD_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    if (window.AndroidBridge) {
      window.AndroidBridge.postMessage(JSON.stringify(message));
    }
  }
}

/**
 * Set up real-time subscriptions for dashboard data
 */
function setupSubscriptions(): void {
  // Subscribe to employees changes
  const employeesChannel = supabase
    .channel('bridge-employees')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, () => {
      console.log('Employees changed, refreshing dashboard...');
      fetchDashboardData();
    })
    .subscribe();

  // Subscribe to payroll changes
  const payrollChannel = supabase
    .channel('bridge-payroll')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll' }, () => {
      console.log('Payroll changed, refreshing dashboard...');
      fetchDashboardData();
    })
    .subscribe();

  // Subscribe to attendance changes
  const attendanceChannel = supabase
    .channel('bridge-attendance')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
      console.log('Attendance changed, refreshing dashboard...');
      fetchDashboardData();
    })
    .subscribe();

  console.log('Real-time subscriptions set up');
}

/**
 * Initialize the bridge when ready
 */
function onBridgeReady(): void {
  console.log('Bridge ready - initializing...');
  setupSubscriptions();
  fetchDashboardData();
}

/**
 * Handle OAuth callback from Google Sign-In (called by Android MainActivity)
 */
async function handleOAuthCallback(accessToken: string, refreshToken: string): Promise<void> {
  console.log('OAuth callback received, setting session...');
  try {
    // Set the session with the received tokens
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      console.error('Error setting session:', error);
      // Notify Android of error
      const message: BridgeMessage = {
        type: 'AUTH_ERROR',
        error: error.message
      };
      if (window.AndroidBridge) {
        window.AndroidBridge.postMessage(JSON.stringify(message));
      }
      return;
    }

    if (data.session) {
      console.log('Session established successfully');
      // Notify Android of successful auth
      const message: BridgeMessage = {
        type: 'AUTH_SUCCESS',
        data: {
          employeeCount: 0,
          activeCount: 0,
          totalPayroll: 0,
          attendanceRate: 0
        }
      };
      if (window.AndroidBridge) {
        window.AndroidBridge.postMessage(JSON.stringify(message));
      }
      // Refresh dashboard data
      fetchDashboardData();
    }
  } catch (err) {
    console.error('Unexpected error in handleOAuthCallback:', err);
  }
}

/**
 * Handle OAuth error (called by Android MainActivity)
 */
function handleOAuthError(error: string): void {
  console.error('OAuth error:', error);
  const message: BridgeMessage = {
    type: 'AUTH_ERROR',
    error: error
  };
  if (window.AndroidBridge) {
    window.AndroidBridge.postMessage(JSON.stringify(message));
  }
}

// Expose functions to window for Android WebView
window.onBridgeReady = onBridgeReady;
window.fetchDashboardData = fetchDashboardData;
window.handleOAuthCallback = handleOAuthCallback;
window.handleOAuthError = handleOAuthError;

// Also export for module usage
export { fetchDashboardData, setupSubscriptions, onBridgeReady, handleOAuthCallback, handleOAuthError };
