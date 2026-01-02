import { useState, useEffect } from "react";
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
  
  // Get departments the team lead is leading
  const userLeadingDepts = user?.leadingDepartments || [];
  const userPrimaryDept = user?.department;

  const priorities = ["Low", "Medium", "High", "Critical"];

  useEffect(() => {
    if (isTeamLead) {
      fetchTasks();
      fetchStats();
      fetchEmployees();
      fetchDepartments();
    }
  }, [filter]);

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
      const filtered = employees.filter(emp => emp.department?._id === departmentId);
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
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

  const groupedTasks = {
    todo: tasks.filter((t) => t.status === "todo"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    completed: tasks.filter((t) => t.status === "completed"),
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="tasks-page">
          {/* Page Header */}
          <div className="page-header">
            <h1>Task Board</h1>
            {isTeamLead && (
              <button className="btn-primary" onClick={() => setShowModal(true)}>
                + Create Task
              </button>
            )}
          </div>

          {isTeamLead && (
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
                {/* To Do Column */}
                <div className="kanban-column">
                  <div className="column-header">
                    <div className="column-title">
                      <i className="fas fa-list"></i> To Do
                      <span className="column-count">{groupedTasks.todo.length}</span>
                    </div>
                  </div>
                  {groupedTasks.todo.length === 0 ? (
                    <div className="empty-column">No tasks</div>
                  ) : (
                    groupedTasks.todo.map((task) => (
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
                            <i className="fas fa-calendar"></i> {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* In Progress Column */}
                <div className="kanban-column">
                  <div className="column-header">
                    <div className="column-title">
                      <i className="fas fa-spinner"></i> In Progress
                      <span className="column-count" style={{ background: "#f59e0b" }}>
                        {groupedTasks["in-progress"].length}
                      </span>
                    </div>
                  </div>
                  {groupedTasks["in-progress"].length === 0 ? (
                    <div className="empty-column">No tasks</div>
                  ) : (
                    groupedTasks["in-progress"].map((task) => (
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
                            <i className="fas fa-calendar"></i> {new Date(task.dueDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Completed Column */}
                <div className="kanban-column">
                  <div className="column-header">
                    <div className="column-title">
                      <i className="fas fa-check-circle"></i> Completed
                      <span className="column-count" style={{ background: "#10b981" }}>
                        {groupedTasks.completed.length}
                      </span>
                    </div>
                  </div>
                  {groupedTasks.completed.length === 0 ? (
                    <div className="empty-column">No tasks</div>
                  ) : (
                    groupedTasks.completed.map((task) => (
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
                          <div className="task-due-date">
                            <i className="fas fa-check"></i> {new Date(task.completedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
                    {isTeamLead && (
                      <button
                        className="btn-edit-task"
                        onClick={() => {
                          setShowDetailModal(false);
                          handleEditTask(selectedTask);
                        }}
                      >
                        <i className="fas fa-edit"></i> Edit Task
                      </button>
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
