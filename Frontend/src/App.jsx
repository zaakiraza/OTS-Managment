import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ToastContainer } from "./Components/Common/Toast/Toast";
import { NotificationProvider } from "./Context/NotificationContext";
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
import Tickets from "./Pages/Tickets/Tickets";
import Tasks from "./Pages/Tasks/Tasks";
import MyTasks from "./Pages/MyTasks/MyTasks";
import MyAssets from "./Pages/MyAssets/MyAssets";
import MyAttendance from "./Pages/MyAttendance/MyAttendance";
import LeaveApproval from "./Pages/LeaveApproval/LeaveApproval";
import Resources from "./Pages/Resources/Resources";
import AuditLogs from "./Pages/AuditLogs/AuditLogs";
import Profile from "./Pages/Profile/Profile";
import Feedback from "./Pages/Feedback/Feedback";
import Todos from "./Pages/Todos/Todos";
import EmailTemplates from "./Pages/EmailTemplates/EmailTemplates";
import Notifications from "./Pages/Notifications/Notifications";

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
          teamLead: "/tasks",
          employee: "/my-tasks",
        };
        return <Navigate to={redirectMap[userRole] || "/login"} />;
      }
    }

    return children;
  };

  return (
    <ToastContainer>
      <NotificationProvider>
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
          path="/audit-logs"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <AuditLogs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/email-templates"
          element={
            <ProtectedRoute allowedRoles={["superAdmin"]}>
              <EmailTemplates />
            </ProtectedRoute>
          }
        />

        {/* SuperAdmin & Attendance Department Routes - Organization Structure */}
        <Route
          path="/departments"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment"]}>
              <Departments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/employees"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment"]}>
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

        {/* All Authenticated Users - Tickets */}
        <Route
          path="/tickets"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead", "employee"]}>
              <Tickets />
            </ProtectedRoute>
          }
        />

        {/* Task Management Routes */}
        <Route
          path="/tasks"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "teamLead"]}>
              <Tasks />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-tasks"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead", "employee"]}>
              <MyTasks />
            </ProtectedRoute>
          }
        />

        {/* Resources Management Routes */}
        <Route
          path="/resources"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "teamLead"]}>
              <Resources />
            </ProtectedRoute>
          }
        />

        {/* My Assets - All Authenticated Users */}
        <Route
          path="/my-assets"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead", "employee"]}>
              <MyAssets />
            </ProtectedRoute>
          }
        />

        {/* My Attendance - All Authenticated Users */}
        <Route
          path="/my-attendance"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead", "employee"]}>
              <MyAttendance />
            </ProtectedRoute>
          }
        />

        {/* Leave Approval - Super Admin and Attendance Department */}
        <Route
          path="/leave-approval"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment"]}>
              <LeaveApproval />
            </ProtectedRoute>
          }
        />

        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Feedback - All Authenticated Users */}
        <Route
          path="/feedback"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead", "employee"]}>
              <Feedback />
            </ProtectedRoute>
          }
        />

        {/* Todos - All Authenticated Users (Private) */}
        <Route
          path="/todos"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead", "employee"]}>
              <Todos />
            </ProtectedRoute>
          }
        />

        {/* Notifications - All Authenticated Users */}
        <Route
          path="/notifications"
          element={
            <ProtectedRoute allowedRoles={["superAdmin", "attendanceDepartment", "ITAssetManager", "teamLead", "employee"]}>
              <Notifications />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </Router>
      </NotificationProvider>
    </ToastContainer>
  );
}

export default App;
