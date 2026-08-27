import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Owners } from "./pages/Owners";
import { OwnerDetail } from "./pages/OwnerDetail";
import { AllCattle } from "./pages/AllCattle";
import { Donations } from "./pages/Donations";
import { Donors } from "./pages/Donors";
import { FeedCatalogue } from "./pages/FeedCatalogue";
import { Rent } from "./pages/Rent";
import { MyInvoices } from "./pages/MyInvoices";
// Public marketing site / portfolio
import { PublicLayout } from "./public/PublicLayout";
import { Home } from "./public/Home";
import { Gallery } from "./public/Gallery";
import { Donate } from "./public/Donate";
import { Contact } from "./public/Contact";
import { Receipt } from "./public/Receipt";
import { DonorsWall } from "./public/DonorsWall";
import { RentInvoicePage } from "./public/RentInvoicePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public website (no auth) */}
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="donate" element={<Donate />} />
            <Route path="donors" element={<DonorsWall />} />
            <Route path="contact" element={<Contact />} />
            {/* Donor's own receipt link — public, keyed on an unguessable token. */}
            <Route path="receipt/:token" element={<Receipt />} />
            {/* Owner's rent invoice link from the monthly email. */}
            <Route path="invoice/:token" element={<RentInvoicePage />} />
          </Route>

          <Route path="/login" element={<Login />} />

          {/* Admin ERP (behind login) */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Dashboard />} />
            <Route
              path="owners"
              element={
                <ProtectedRoute permission="owners.read">
                  <Owners />
                </ProtectedRoute>
              }
            />
            <Route
              path="owners/:id"
              element={
                <ProtectedRoute permission="cattle.read">
                  <OwnerDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="cattle"
              element={
                <ProtectedRoute permission="cattle.read">
                  <AllCattle />
                </ProtectedRoute>
              }
            />
            <Route
              path="donations"
              element={
                <ProtectedRoute permission="donations.read">
                  <Donations />
                </ProtectedRoute>
              }
            />
            <Route
              path="donors"
              element={
                <ProtectedRoute permission="donors.read">
                  <Donors />
                </ProtectedRoute>
              }
            />
            <Route
              path="feed"
              element={
                <ProtectedRoute permission="feed.read">
                  <FeedCatalogue />
                </ProtectedRoute>
              }
            />
            <Route
              path="rent"
              element={
                <ProtectedRoute permission="rent.read">
                  <Rent />
                </ProtectedRoute>
              }
            />
            {/* Owners see their own invoices — scoped server-side, so no
                permission gate beyond being signed in. */}
            <Route path="invoices" element={<MyInvoices />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
