import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import SideBar from "../../Components/SideBar/SideBar";
import taskAPI from "../../Config/taskApi";
import { employeeAPI, departmentAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Tasks.css";

function Tasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newComment, setNewComment] = useState("");
  const [filter, setFilter] = useState({
    department: "",
    priority: "",
    employee: "",
    dateRange: "active", // 'active', 'today', 'week', 'month', 'all'
    groupBy: "status", // 'status', 'week', 'month'
  });
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "Medium",
    dueDate: "",
    department: "",
    assignedTo: [], // Changed to array for multi-select
  });

  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
  const isSuperAdmin = user?.role?.name === "superAdmin";
  const isTeamLead = ["superAdmin", "teamLead"].includes(user?.role?.name);
  const canViewTasks = ["superAdmin", "teamLead", "attendanceDepartment"].includes(user?.role?.name);
  const canCreateTasks = ["superAdmin", "teamLead", "attendanceDepartment"].includes(user?.role?.name);
  
  // Get departments the team lead is leading
  const userLeadingDepts = user?.leadingDepartments || [];
  const userPrimaryDept = user?.department;

  const priorities = ["Low", "Medium", "High", "Critical"];

  useEffect(() => {
    if (canViewTasks) {
      fetchTasks();
      fetchStats();
      fetchEmployees();
      fetchDepartments();
    }
  }, [filter]);

  // Update filtered employees when department changes or employees are loaded
  useEffect(() => {
    if (formData.department && employees.length > 0) {
      // Convert both to strings for comparison
      const deptIdStr = String(formData.department);
      const filtered = employees.filter(emp => {
        const empDeptId = emp.department?._id || emp.department;
        return String(empDeptId) === deptIdStr;
      });
      setFilteredEmployees(filtered);
    } else if (!formData.department) {
      setFilteredEmployees([]);
    }
  }, [formData.department, employees]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.department) params.department = filter.department;
      if (filter.priority) params.priority = filter.priority;
      if (filter.employee) params.assignedTo = filter.employee;

      const response = await taskAPI.getAll(params);
      if (response.data.success) {
        setTasks(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const params = {};
      if (filter.department) params.department = filter.department;
      
      const response = await taskAPI.getStats(params);
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const params = { isActive: true };
      
      const response = await employeeAPI.getAll(params);
      if (response.data.success) {
        let empList = response.data.data;
        
        // For teamLead, filter employees by departments they lead
        if (user?.role?.name === "teamLead" && !isSuperAdmin) {
          const leadingDeptIds = userLeadingDepts.map(d => d._id || d);
          
          // Include employees from departments they lead
          empList = empList.filter(emp => 
            leadingDeptIds.includes(emp.department?._id) ||
            emp.additionalDepartments?.some(d => leadingDeptIds.includes(d._id || d))
          );
        }
        
        setEmployees(empList);
        setFilteredEmployees(empList);
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        const allDepts = response.data.flatData || response.data.data;
        
        // For superAdmin, show all departments
        if (isSuperAdmin) {
          setDepartments(allDepts);
        } 
        // For teamLead, only show departments they are leading
        else if (user?.role?.name === "teamLead") {
          // Get IDs of departments the user is leading
          const leadingDeptIds = userLeadingDepts.map(d => d._id || d);
          
          // Filter departments to only show the ones they lead
          const userDepts = allDepts.filter(dept => 
            leadingDeptIds.includes(dept._id)
          );
          
          // If they're not leading any department, show their primary department
          if (userDepts.length === 0 && userPrimaryDept) {
            const primaryDept = allDepts.find(d => d._id === (userPrimaryDept._id || userPrimaryDept));
            if (primaryDept) {
              userDepts.push(primaryDept);
            }
          }
          
          setDepartments(userDepts);
          
          // Auto-select if only one department
          if (userDepts.length === 1) {
            setFormData(prev => ({ ...prev, department: userDepts[0]._id }));
            handleDepartmentChange(userDepts[0]._id);
          }
        } else {
          setDepartments(allDepts);
        }
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleDepartmentChange = (departmentId) => {
    setFormData({ ...formData, department: departmentId, assignedTo: [] });
    
    if (departmentId) {
      // Convert both to strings for comparison
      const deptIdStr = String(departmentId);
      const filtered = employees.filter(emp => {
        const empDeptId = emp.department?._id || emp.department;
        return String(empDeptId) === deptIdStr;
      });
      setFilteredEmployees(filtered);
      console.log(`[Tasks] Department changed to: ${departmentId}, Found ${filtered.length} employees`);
    } else {
      setFilteredEmployees([]);
    }
  };

  const handleEmployeeToggle = (employeeId) => {
    const current = formData.assignedTo || [];
    const newAssigned = current.includes(employeeId)
      ? current.filter(id => id !== employeeId)
      : [...current, employeeId];
    setFormData({ ...formData, assignedTo: newAssigned });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (selectedTask) {
        await taskAPI.update(selectedTask._id, formData);
        toast.success("Task updated successfully!");
      } else {
        await taskAPI.create(formData);
        toast.success("Task created successfully!");
      }
      resetForm();
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error("Error submitting task:", error);
      toast.error(error.response?.data?.message || "Failed to submit task");
    } finally {
      setLoading(false);
    }
  };

  const handleViewTask = async (task) => {
    try {
      const response = await taskAPI.getById(task._id);
      if (response.data.success) {
        setSelectedTask(response.data.data);
        setShowDetailModal(true);
      }
    } catch (error) {
      console.error("Error fetching task details:", error);
      toast.error("Failed to load task details");
    }
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    // Handle both single assignee (old format) and array (new format)
    const assignedToArray = Array.isArray(task.assignedTo) 
      ? task.assignedTo.map(emp => emp._id || emp)
      : [task.assignedTo?._id || task.assignedTo];
    
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      dueDate: task.dueDate.split("T")[0],
      department: task.department?._id || "",
      assignedTo: assignedToArray,
    });
    
    if (task.department?._id) {
      const filtered = employees.filter(emp => emp.department?._id === task.department._id);
      setFilteredEmployees(filtered);
    }
    
    setShowModal(true);
  };

  const handleDeleteTask = async (id) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try {
      await taskAPI.delete(id);
      toast.success("Task deleted successfully!");
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error(error.response?.data?.message || "Failed to delete task");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const response = await taskAPI.addComment(selectedTask._id, newComment);
      if (response.data.success) {
        setSelectedTask(response.data.data);
        setNewComment("");
        fetchTasks();
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
  };

  // Handle status change for superAdmin/teamLead
  const handleStatusChange = async (newStatus) => {
    try {
      const response = await taskAPI.updateStatus(selectedTask._id, newStatus);
      if (response.data.success) {
        setSelectedTask(response.data.data);
        fetchTasks();
        fetchStats();
        toast.success(`Task status updated to "${newStatus.replace("-", " ")}"`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "Medium",
      dueDate: "",
      department: "",
      assignedTo: [],
    });
    setFilteredEmployees(employees);
    setSelectedTask(null);
    setShowModal(false);
  };

  const getPriorityColor = (priority) => {
    const colors = {
      Low: "#10b981",
      Medium: "#f59e0b",
      High: "#ef4444",
      Critical: "#7c3aed",
    };
    return colors[priority] || "#999";
  };

  const getTaskDateStatus = (task) => {
    if (!task.dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    return { today, dueDate, weekStart, weekEnd, monthStart, monthEnd };
  };

  const filterTasksByDateRange = (tasksToFilter) => {
    return tasksToFilter.filter((task) => {
      // Always exclude completed tasks unless viewing 'all'
      if (task.status === "completed" && filter.dateRange !== "all") {
        return false;
      }

      const dateStatus = getTaskDateStatus(task);
      if (!dateStatus) return true; // No due date, show it

      const { today, dueDate, weekStart, weekEnd, monthStart, monthEnd } = dateStatus;

      switch (filter.dateRange) {
        case "active": // Not completed and not overdue
          return dueDate >= today;
        case "today":
          return dueDate.getTime() === today.getTime();
        case "week":
          return dueDate >= weekStart && dueDate <= weekEnd;
        case "month":
          return dueDate >= monthStart && dueDate <= monthEnd;
        case "all":
          return true;
        default:
          return true;
      }
    });
  };

  const getWeekLabel = (date) => {
    const d = new Date(date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
  };

  const getMonthLabel = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  const groupTasksByWeek = (tasksToGroup) => {
    const grouped = {};
    tasksToGroup.forEach((task) => {
      if (!task.dueDate) {
        if (!grouped["No Due Date"]) grouped["No Due Date"] = [];
        grouped["No Due Date"].push(task);
      } else {
        const label = getWeekLabel(task.dueDate);
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(task);
      }
    });
    return grouped;
  };

  const groupTasksByMonth = (tasksToGroup) => {
    const grouped = {};
    tasksToGroup.forEach((task) => {
      if (!task.dueDate) {
        if (!grouped["No Due Date"]) grouped["No Due Date"] = [];
        grouped["No Due Date"].push(task);
      } else {
        const label = getMonthLabel(task.dueDate);
        if (!grouped[label]) grouped[label] = [];
        grouped[label].push(task);
      }
    });
    return grouped;
  };

  const isOverdue = (dueDate) => {
    return new Date(dueDate) < new Date() && selectedTask?.status !== "completed";
  };

  // Helper to render multiple assignees
  const renderAssignees = (assignedTo, showFull = false) => {
    if (!assignedTo) return "Unassigned";
    
    // Handle both array and single object (for backward compatibility)
    const assignees = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    
    if (assignees.length === 0) return "Unassigned";
    
    if (showFull) {
      return assignees.map(emp => `${emp.name} (${emp.employeeId})`).join(", ");
    }
    
    if (assignees.length === 1) {
      return assignees[0]?.name || "Unknown";
    }
    
    return (
      <div className="assignee-badges">
        <span className="assignee-badge">{assignees[0]?.name}</span>
        {assignees.length > 1 && (
          <span className="assignee-badge more">+{assignees.length - 1}</span>
        )}
      </div>
    );
  };

  const exportTasksToExcel = () => {
    try {
      const exportData = filteredTasksList.map((task) => ({
        "Task ID": task.taskId,
        "Title": task.title,
        "Description": task.description || "-",
        "Priority": task.priority,
        "Status": task.status.replace("-", " ").charAt(0).toUpperCase() + task.status.slice(1),
        "Assigned To": renderAssignees(task.assignedTo, true),
        "Department": task.department?.name || "-",
        "Due Date": task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date",
        "Completed At": task.completedAt ? new Date(task.completedAt).toLocaleDateString() : "-",
      }));

      if (exportData.length === 0) {
        toast.error("No tasks to export");
        return;
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      
      // Set column widths
      const colWidths = [
        { wch: 10 },
        { wch: 25 },
        { wch: 30 },
        { wch: 12 },
        { wch: 15 },
        { wch: 25 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
      ];
      worksheet["!cols"] = colWidths;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tasks");
      
      const fileName = `Tasks_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success("Tasks exported to Excel");
    } catch (error) {
      console.error("Error exporting tasks:", error);
      toast.error("Failed to export tasks");
    }
  };

  const filteredTasksList = filterTasksByDateRange(tasks);
  
  let groupedTasks = {};
  if (filter.groupBy === "week") {
    groupedTasks = groupTasksByWeek(filteredTasksList);
  } else if (filter.groupBy === "month") {
    groupedTasks = groupTasksByMonth(filteredTasksList);
  } else {
    // Default: group by status
    groupedTasks = {
      todo: filteredTasksList.filter((t) => t.status === "todo"),
      "in-progress": filteredTasksList.filter((t) => t.status === "in-progress"),
      completed: filteredTasksList.filter((t) => t.status === "completed"),
    };
  }

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="tasks-page">
          {/* Page Header */}
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-tasks"></i>
              </div>
              <div>
                <h1>Task Board</h1>
                <p>Assign and manage team tasks</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {canCreateTasks && (
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                  + Create Task
                </button>
              )}
              {canViewTasks && (
                <button
                  className="btn-primary"
                  onClick={exportTasksToExcel}
                  style={{
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    padding: "10px 18px",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    transition: "all 0.3s ease",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.background = "#2563eb";
                    e.target.style.boxShadow = "0 6px 16px rgba(59, 130, 246, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.background = "#3b82f6";
                    e.target.style.boxShadow = "none";
                  }}
                >
                  <i className="fas fa-download"></i> Export to Excel
                </button>
              )}
            </div>
          </div>

          {canViewTasks && (
            <>
              {/* Stats */}
              <div className="stats-container">
                <div className="stat-card">
                  <h3>Total Tasks</h3>
                  <div className="value">{stats.total || 0}</div>
                </div>
                <div className="stat-card">
                  <h3>To Do</h3>
                  <div className="value" style={{ color: "#94a3b8" }}>
                    {stats.todo || 0}
                  </div>
                </div>
                <div className="stat-card">
                  <h3>In Progress</h3>
                  <div className="value" style={{ color: "#f59e0b" }}>
                    {stats.inProgress || 0}
                  </div>
                </div>
                <div className="stat-card">
                  <h3>Completed</h3>
                  <div className="value" style={{ color: "#10b981" }}>
                    {stats.completed || 0}
                  </div>
                </div>
                <div className="stat-card">
                  <h3>Overdue</h3>
                  <div className="value" style={{ color: "#ef4444" }}>
                    {stats.overdue || 0}
                  </div>
                </div>
              </div>

              {/* Filters */}
              <div className="filters">
                <div className="filter-group">
                  <label>Date Range</label>
                  <select
                    value={filter.dateRange}
                    onChange={(e) => setFilter({ ...filter, dateRange: e.target.value })}
                  >
                    <option value="active">Active (Not Completed & Not Overdue)</option>
                    <option value="today">Today</option>
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="all">All Tasks</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Group By</label>
                  <select
                    value={filter.groupBy}
                    onChange={(e) => setFilter({ ...filter, groupBy: e.target.value })}
                  >
                    <option value="status">By Status (To Do, In Progress, Completed)</option>
                    <option value="week">By Week</option>
                    <option value="month">By Month</option>
                  </select>
                </div>
                <div className="filter-group">
                  <label>Department</label>
                  <select
                    value={filter.department}
                    onChange={(e) => setFilter({ ...filter, department: e.target.value })}
                  >
                    <option value="">All Departments</option>
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Priority</label>
                  <select
                    value={filter.priority}
                    onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                  >
                    <option value="">All Priorities</option>
                    {priorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-group">
                  <label>Employee</label>
                  <select
                    value={filter.employee}
                    onChange={(e) => setFilter({ ...filter, employee: e.target.value })}
                  >
                    <option value="">All Employees</option>
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name} - {emp.employeeId}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Kanban Board */}
              <div className="kanban-board">
                {Object.entries(groupedTasks).map(([columnName, columnTasks]) => {
                  // Determine column icon and styling based on groupBy type
                  let columnIcon = "fas fa-list";
                  let columnColor = "#94a3b8";
                  
                  if (filter.groupBy === "status") {
                    if (columnName === "todo") columnIcon = "fas fa-list";
                    else if (columnName === "in-progress") {
                      columnIcon = "fas fa-spinner";
                      columnColor = "#f59e0b";
                    } else if (columnName === "completed") {
                      columnIcon = "fas fa-check-circle";
                      columnColor = "#10b981";
                    }
                  } else if (filter.groupBy === "week") {
                    columnIcon = "fas fa-calendar-week";
                    columnColor = "#8b5cf6";
                  } else if (filter.groupBy === "month") {
                    columnIcon = "fas fa-calendar";
                    columnColor = "#06b6d4";
                  }

                  // Format column title
                  const displayName = columnName.charAt(0).toUpperCase() + columnName.slice(1);

                  return (
                    <div key={columnName} className="kanban-column">
                      <div className="column-header">
                        <div className="column-title">
                          <i className={columnIcon}></i> {displayName}
                          <span className="column-count" style={{ background: columnColor }}>
                            {columnTasks.length}
                          </span>
                        </div>
                      </div>
                      {columnTasks.length === 0 ? (
                        <div className="empty-column">No tasks</div>
                      ) : (
                        columnTasks.map((task) => (
                          <div
                            key={task._id}
                            className={`task-card priority-${task.priority.toLowerCase()}`}
                            onClick={() => handleViewTask(task)}
                          >
                            <div className="task-header">
                              <span className="task-id">{task.taskId}</span>
                              <span
                                className="priority-badge"
                                style={{
                                  background: getPriorityColor(task.priority),
                                  color: "white",
                                }}
                              >
                                {task.priority}
                              </span>
                            </div>
                            <div className="task-title">{task.title}</div>
                            {task.description && (
                              <div className="task-description">{task.description}</div>
                            )}
                            <div className="task-meta">
                              <div className="task-assignee">
                                <i className="fas fa-user"></i> {renderAssignees(task.assignedTo)}
                              </div>
                              <div
                                className={`task-due-date ${
                                  isOverdue(task.dueDate) ? "overdue" : ""
                                }`}
                              >
                                <i className="fas fa-calendar"></i> {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Create/Edit Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>{selectedTask ? "Edit Task" : "Create New Task"}</h2>
                  <button className="close-btn" onClick={() => setShowModal(false)}>
                    ×
                  </button>
                </div>
                <form onSubmit={handleSubmit}>
                  <div className="modal-body">
                    <div className="form-group">
                      <label>Task Title *</label>
                      <input
                        type="text"
                        value={formData.title}
                        onChange={(e) =>
                          setFormData({ ...formData, title: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={4}
                      />
                    </div>

                    <div className="form-group">
                      <label>Priority *</label>
                      <select
                        value={formData.priority}
                        onChange={(e) =>
                          setFormData({ ...formData, priority: e.target.value })
                        }
                        required
                      >
                        {priorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Due Date *</label>
                      <input
                        type="date"
                        value={formData.dueDate}
                        onChange={(e) =>
                          setFormData({ ...formData, dueDate: e.target.value })
                        }
                        required
                        min={new Date().toISOString().split("T")[0]}
                      />
                    </div>

                    <div className="form-group">
                      <label>Department *</label>
                      <select
                        value={formData.department}
                        onChange={(e) => handleDepartmentChange(e.target.value)}
                        required
                        disabled={user?.userType === "employee"}
                      >
                        <option value="">Select Department</option>
                        {departments.map((dept) => (
                          <option key={dept._id} value={dept._id}>
                            {dept.name}
                          </option>
                        ))}
                      </select>
                      {user?.userType === "employee" && (
                        <small style={{color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block'}}>
                          You can only assign tasks within your department
                        </small>
                      )}
                    </div>

                    <div className="form-group">
                      <label>Assign To *</label>
                      <div className="employee-select-grid">
                        {filteredEmployees.length === 0 ? (
                          <p className="no-employees-msg">
                            <i className="fas fa-info-circle"></i> Select a department first
                          </p>
                        ) : (
                          filteredEmployees.map((emp) => (
                            <label 
                              key={emp._id} 
                              className={`employee-select-item ${formData.assignedTo?.includes(emp._id) ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.assignedTo?.includes(emp._id)}
                                onChange={() => handleEmployeeToggle(emp._id)}
                              />
                              <div className="emp-avatar">
                                {emp.name?.charAt(0).toUpperCase()}
                              </div>
                              <div className="emp-details">
                                <span className="emp-name">{emp.name}</span>
                                <span className="emp-meta">{emp.employeeId} • {emp.position || 'Employee'}</span>
                              </div>
                              <div className="emp-check">
                                <i className="fas fa-check"></i>
                              </div>
                            </label>
                          ))
                        )}
                      </div>
                      {formData.assignedTo?.length > 0 && (
                        <div className="selected-count">
                          <i className="fas fa-users"></i> {formData.assignedTo.length} employee(s) selected
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading ? "Saving..." : selectedTask ? "Update" : "Create"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Task Detail Modal */}
          {showDetailModal && selectedTask && (
            <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
              <div className="modal-content task-detail-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="task-detail-header-info">
                    <span className="task-id-badge">{selectedTask.taskId}</span>
                    <span 
                      className="priority-badge-lg"
                      style={{ background: getPriorityColor(selectedTask.priority) }}
                    >
                      {selectedTask.priority}
                    </span>
                  </div>
                  <button className="close-btn" onClick={() => setShowDetailModal(false)}>
                    ×
                  </button>
                </div>
                
                <div className="task-detail-body">
                  {/* Task Title & Description */}
                  <div className="task-detail-top">
                    <h2 className="task-detail-title">{selectedTask.title}</h2>
                    {selectedTask.description && (
                      <p className="task-detail-desc">{selectedTask.description}</p>
                    )}
                    {canCreateTasks && (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className="btn-edit-task"
                          onClick={() => {
                            setShowDetailModal(false);
                            handleEditTask(selectedTask);
                          }}
                        >
                          <i className="fas fa-edit"></i> Edit Task
                        </button>
                        <button
                          className="btn-delete-task"
                          onClick={() => {
                            setShowDetailModal(false);
                            handleDeleteTask(selectedTask._id);
                          }}
                          style={{
                            background: "#ef4444",
                            color: "white",
                            border: "none",
                            padding: "8px 16px",
                            borderRadius: "6px",
                            cursor: "pointer",
                            fontSize: "14px",
                            fontWeight: "600",
                          }}
                        >
                          <i className="fas fa-trash"></i> Delete Task
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status Update Section */}
                  <div className="status-section">
                    <h4><i className="fas fa-sync-alt"></i> Update Status</h4>
                    <div className="status-buttons">
                      <button
                        className={`status-btn ${selectedTask.status === "todo" ? "active" : ""}`}
                        onClick={() => handleStatusChange("todo")}
                        disabled={selectedTask.status === "todo"}
                      >
                        <i className="fas fa-list"></i>
                        <span>To Do</span>
                      </button>
                      <button
                        className={`status-btn in-progress ${selectedTask.status === "in-progress" ? "active" : ""}`}
                        onClick={() => handleStatusChange("in-progress")}
                        disabled={selectedTask.status === "in-progress"}
                      >
                        <i className="fas fa-spinner"></i>
                        <span>In Progress</span>
                      </button>
                      <button
                        className={`status-btn completed ${selectedTask.status === "completed" ? "active" : ""}`}
                        onClick={() => handleStatusChange("completed")}
                        disabled={selectedTask.status === "completed"}
                      >
                        <i className="fas fa-check-circle"></i>
                        <span>Completed</span>
                      </button>
                    </div>
                  </div>

                  {/* Task Meta Grid */}
                  <div className="task-meta-grid">
                    <div className="meta-card">
                      <div className="meta-icon"><i className="fas fa-user"></i></div>
                      <div className="meta-content">
                        <span className="meta-label">Assigned To</span>
                        <span className="meta-value">{renderAssignees(selectedTask.assignedTo, true)}</span>
                      </div>
                    </div>
                    <div className="meta-card">
                      <div className="meta-icon"><i className="fas fa-building"></i></div>
                      <div className="meta-content">
                        <span className="meta-label">Department</span>
                        <span className="meta-value">{selectedTask.department?.name || '-'}</span>
                      </div>
                    </div>
                    <div className="meta-card">
                      <div className="meta-icon"><i className="fas fa-user-tie"></i></div>
                      <div className="meta-content">
                        <span className="meta-label">Assigned By</span>
                        <span className="meta-value">{selectedTask.assignedBy?.name || '-'}</span>
                      </div>
                    </div>
                    <div className="meta-card">
                      <div className="meta-icon"><i className="fas fa-calendar-alt"></i></div>
                      <div className="meta-content">
                        <span className="meta-label">Due Date</span>
                        <span className="meta-value">{new Date(selectedTask.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    {selectedTask.startedAt && (
                      <div className="meta-card">
                        <div className="meta-icon"><i className="fas fa-play-circle"></i></div>
                        <div className="meta-content">
                          <span className="meta-label">Started At</span>
                          <span className="meta-value">{new Date(selectedTask.startedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {selectedTask.completedAt && (
                      <div className="meta-card">
                        <div className="meta-icon"><i className="fas fa-check-double"></i></div>
                        <div className="meta-content">
                          <span className="meta-label">Completed At</span>
                          <span className="meta-value">{new Date(selectedTask.completedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="comments-section">
                    <h4><i className="fas fa-comments"></i> Comments</h4>
                    <div className="comments-list">
                      {selectedTask.comments && selectedTask.comments.length > 0 ? (
                        selectedTask.comments.map((comment, index) => (
                          <div key={index} className="comment-item">
                            <div className="comment-avatar">
                              {(comment.employee?.name || comment.user?.name || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="comment-body">
                              <div className="comment-header">
                                <span className="comment-author">
                                  {comment.employee?.name || comment.user?.name || "Unknown"}
                                  {comment.employee && <span className="comment-emp-id">({comment.employee.employeeId})</span>}
                                </span>
                                <span className="comment-date">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="comment-text">{comment.comment}</p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="no-comments">No comments yet</p>
                      )}
                    </div>

                    <div className="add-comment">
                      <input
                        type="text"
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") handleAddComment();
                        }}
                      />
                      <button onClick={handleAddComment}>
                        <i className="fas fa-paper-plane"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Tasks;
