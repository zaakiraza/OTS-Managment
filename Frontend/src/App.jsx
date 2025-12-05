import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./Pages/Login/Login";
import Dashboard from "./Pages/Dashboard/Dashboard";
import Users from "./Pages/Users/Users";
import Roles from "./Pages/Roles/Roles";
import Attendance from "./Pages/Attendance/Attendance";
import Reports from "./Pages/Reports/Reports";
import Departments from "./Pages/Departments/Departments";
import Employees from "./Pages/Employees/Employees";
import Salaries from "./Pages/Salaries/Salaries";
import Import from "./Pages/Import/Import";
import Assets from "./Pages/Assets/Assets";
import Organization from "./Pages/Organization/Organization";

function App() {
  const isAuthenticated = () => {
    return localStorage.getItem("token") !== null;
  };

  const getUser = () => {
    const user = localStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  };

  const getUserRole = () => {
    const user = getUser();
    return user?.role?.name || null;
  };

  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" />;
    }

    // If allowedRoles is specified, check if user has permission
    if (allowedRoles && allowedRoles.length > 0) {
      const userRole = getUserRole();
      if (!allowedRoles.includes(userRole)) {
        // Redirect to appropriate landing page based on role
        const redirectMap = {
          superAdmin: "/dashboard",
          attendanceDepartment: "/attendance",
          ITAssetManager: "/assets",
        };
        return <Navigate to={redirectMap[userRole] || "/login"} />;
      }
    }

    return children;
  };

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* SuperAdmin Only Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/roles"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <Roles />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organization"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <Organization />
            </ProtectedRoute>
          }
        />

        {/* SuperAdmin Only Routes - Organization Structure */}
        <Route
          path="/departments"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <Employees />
            </ProtectedRoute>
          }
        />

        {/* SuperAdmin & Attendance Department Routes */}
        <Route
          path="/attendance"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment"]}>
              <Attendance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/salaries"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment"]}>
              <Salaries />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment"]}>
              <Import />
            </ProtectedRoute>
          }
        />

        {/* SuperAdmin & Attendance Department - Reports */}
        <Route
          path="/reports"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment"]}>
              <Reports />
            </ProtectedRoute>
          }
        />

        {/* SuperAdmin & Asset Manager Routes */}
        <Route
          path="/assets"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "ITAssetManager"]}>
              <Assets />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
