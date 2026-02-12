import { createBrowserRouter, Navigate } from "react-router";
import { AdminGuard } from "@/components/auth/AdminGuard";
import { SuperadminGuard } from "@/components/auth/SuperadminGuard";
import RootLayout from "@/components/layout/RootLayout";
import ErrorScreen from "@/error";
import DashboardPage from "@/pages/App";
import LoginScreen from "@/pages/Login";
import VerifyOtpPage from "@/pages/VerifyOtp";
import UsersPage from "@/pages/Users";
import AdminUsersPage from "@/pages/AdminUsers";
import PricingPage from "@/pages/Pricing";
import ContentPage from "@/pages/Content";
import DriversPage from "@/pages/Drivers";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginScreen,
  },
  {
    path: "/verify-otp",
    Component: VerifyOtpPage,
  },
  {
    path: "/",
    Component: RootLayout,
    ErrorBoundary: ErrorScreen,
    children: [
      {
        index: true,
        element: (
          <AdminGuard>
            <DashboardPage />
          </AdminGuard>
        ),
      },
      {
        path: "users",
        element: (
          <AdminGuard>
            <UsersPage />
          </AdminGuard>
        ),
      },
      {
        path: "drivers",
        element: (
          <AdminGuard>
            <DriversPage />
          </AdminGuard>
        ),
      },
      {
        path: "pricing",
        element: (
          <AdminGuard>
            <PricingPage />
          </AdminGuard>
        ),
      },
      {
        path: "content",
        element: (
          <AdminGuard>
            <ContentPage />
          </AdminGuard>
        ),
      },
      {
        path: "admin-users",
        element: (
          <AdminGuard>
            <SuperadminGuard>
              <AdminUsersPage />
            </SuperadminGuard>
          </AdminGuard>
        ),
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
