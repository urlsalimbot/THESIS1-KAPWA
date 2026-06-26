import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser } from '../lib/auth-context';

interface ProtectedRouteProps {
  children: React.ReactNode;
  roles?: string[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, [navigate, roles]);

  async function checkAuth() {
    const token = localStorage.getItem('kapwa_token');
    if (!token) {
      navigate('/login');
      return;
    }

    try {
      const user = await getCurrentUser();
      if (!user) {
        localStorage.removeItem('kapwa_token');
        navigate('/login');
        return;
      }

      if (roles && roles.length > 0 && !roles.includes(user.role)) {
        navigate('/');
        return;
      }

      setAuthorized(true);
    } catch {
      localStorage.removeItem('kapwa_token');
      navigate('/login');
    }
  }

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Verifying access...</div>;
  }

  return <>{children}</>;
}
