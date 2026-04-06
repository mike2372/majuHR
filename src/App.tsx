import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { EmployeeDirectory } from './components/EmployeeDirectory';
import { Payroll } from './components/Payroll';
import { Attendance } from './components/Attendance';
import { UserProvider } from './contexts/UserContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';

export default function App() {
  return (
    <UserProvider>
      <NotificationProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route 
              path="employees" 
              element={
                <ProtectedRoute allowedRoles={['HR Admin', 'Manager']}>
                  <EmployeeDirectory />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="payroll" 
              element={
                <ProtectedRoute allowedRoles={['HR Admin']}>
                  <Payroll />
                </ProtectedRoute>
              } 
            />
            <Route path="attendance" element={<Attendance />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </NotificationProvider>
    </UserProvider>
  );
}
