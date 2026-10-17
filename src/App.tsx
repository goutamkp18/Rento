import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { FavouritesProvider } from './context/FavouritesContext';
import { CompareProvider } from './context/CompareContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { logSupabaseStatus } from './lib/supabase';

// Layouts
import { RootLayout } from './layouts/RootLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { OwnerLayout } from './layouts/OwnerLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Route Guards
import { AdminRoute } from './components/auth/AdminRoute';
import { StudentRoute } from './components/auth/StudentRoute';
import { OwnerRoute } from './components/auth/OwnerRoute';

// Public Pages
import { HomePage } from './pages/public/HomePage';
import { ExplorePage } from './pages/public/ExplorePage';
import { ListingDetailsPage } from './pages/public/ListingDetailsPage';
import { BookingCheckoutPage } from './pages/public/BookingCheckoutPage';
import { HowItWorksPage } from './pages/public/HowItWorksPage';
import { OwnersLandingPage } from './pages/public/OwnersLandingPage';
import { PricingPage } from './pages/public/PricingPage';
import { UnauthorizedPage } from './pages/public/UnauthorizedPage';
import { NotFoundPage } from './pages/public/NotFoundPage';

// Auth Pages
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { AdminLoginPage } from './pages/admin/AdminLoginPage';

// Student Pages
import { StudentDashboardPage } from './pages/student/StudentDashboardPage';
import { StudentComparePage } from './pages/student/StudentComparePage';
import { StudentFavouritesPage } from './pages/student/StudentFavouritesPage';
import { StudentEnquiriesPage } from './pages/student/StudentEnquiriesPage';
import { StudentProfilePage } from './pages/student/StudentProfilePage';

// Owner Pages
import { OwnerDashboardPage } from './pages/owner/OwnerDashboardPage';
import { OwnerListingsPage } from './pages/owner/OwnerListingsPage';
import { CreateEditListingPage } from './pages/owner/CreateEditListingPage';
import { OwnerRoomsPage } from './pages/owner/OwnerRoomsPage';
import { OwnerEnquiriesPage } from './pages/owner/OwnerEnquiriesPage';
import { OwnerSubscriptionPage } from './pages/owner/OwnerSubscriptionPage';
import { OwnerSettingsPage } from './pages/owner/OwnerSettingsPage';
import { OwnerModulePlaceholder } from './pages/owner/OwnerModulePlaceholder';
import { PlanSelectionPage } from './pages/owner/PlanSelectionPage';
import { CheckoutPage } from './pages/owner/CheckoutPage';

// Admin Pages
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { AdminListingsPage } from './pages/admin/AdminListingsPage';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';

export function App() {
  useEffect(() => {
    logSupabaseStatus();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <SubscriptionProvider>
              <FavouritesProvider>
                <CompareProvider>
                  <Routes>
                    {/* Owner Onboarding & Checkout Routes */}
                    <Route path="/owner/plans" element={<PlanSelectionPage />} />
                    <Route path="/owner/checkout" element={<CheckoutPage />} />

                    {/* Public Website Routes */}
                    <Route element={<RootLayout />}>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/pgs" element={<ExplorePage />} />
                      <Route path="/pgs/:id" element={<ListingDetailsPage />} />
                      <Route path="/book/:id" element={<BookingCheckoutPage />} />
                      <Route path="/pgs/:id/book" element={<BookingCheckoutPage />} />
                      <Route path="/how-it-works" element={<HowItWorksPage />} />
                      <Route path="/owners" element={<OwnersLandingPage />} />
                      <Route path="/pricing" element={<PricingPage />} />
                      <Route path="/unauthorized" element={<UnauthorizedPage />} />
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>

                    {/* Public Authentication Routes */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/signup" element={<SignupPage />} />
                    <Route path="/forgot-password" element={<ForgotPasswordPage />} />

                    {/* Dedicated Administrator Authentication Gateway */}
                    <Route path="/admin/login" element={<AdminLoginPage />} />

                    {/* Student Portal Routes (Protected by StudentRoute) */}
                    <Route
                      path="/student"
                      element={
                        <StudentRoute>
                          <StudentLayout />
                        </StudentRoute>
                      }
                    >
                      <Route index element={<Navigate to="/student/dashboard" replace />} />
                      <Route path="dashboard" element={<StudentDashboardPage />} />
                      <Route path="compare" element={<StudentComparePage />} />
                      <Route path="favourites" element={<StudentFavouritesPage />} />
                      <Route path="enquiries" element={<StudentEnquiriesPage />} />
                      <Route path="profile" element={<StudentProfilePage />} />
                    </Route>

                    {/* PG Owner SaaS Portal Routes (Protected by OwnerRoute) */}
                    <Route
                      path="/owner"
                      element={
                        <OwnerRoute>
                          <OwnerLayout />
                        </OwnerRoute>
                      }
                    >
                      <Route index element={<Navigate to="/owner/dashboard" replace />} />
                      <Route path="dashboard" element={<OwnerDashboardPage />} />
                      <Route path="listings" element={<OwnerListingsPage />} />
                      <Route path="listings/new" element={<CreateEditListingPage />} />
                      <Route path="listings/:id/edit" element={<CreateEditListingPage />} />
                      <Route path="listings/:id/rooms" element={<OwnerRoomsPage />} />
                      <Route path="rooms" element={<OwnerRoomsPage />} />
                      <Route path="enquiries" element={<OwnerEnquiriesPage />} />
                      <Route path="tenants" element={<OwnerModulePlaceholder />} />
                      <Route path="maintenance" element={<OwnerModulePlaceholder />} />
                      <Route path="analytics" element={<OwnerModulePlaceholder />} />
                      <Route path="subscription" element={<OwnerSubscriptionPage />} />
                      <Route path="settings" element={<OwnerSettingsPage />} />
                    </Route>

                    {/* Administrator Operations Portal (Protected by AdminRoute) */}
                    <Route
                      path="/admin"
                      element={
                        <AdminRoute>
                          <AdminLayout />
                        </AdminRoute>
                      }
                    >
                      <Route index element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="dashboard" element={<AdminDashboardPage />} />
                      <Route path="listings" element={<AdminListingsPage />} />
                      <Route path="listings/:id" element={<AdminListingsPage />} />
                      <Route path="users" element={<AdminUsersPage />} />
                    </Route>
                  </Routes>
                </CompareProvider>
              </FavouritesProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
