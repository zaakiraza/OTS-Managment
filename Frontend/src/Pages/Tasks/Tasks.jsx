import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import taskAPI from "../../Config/taskApi";
import { employeeAPI, departmentAPI } from "../../Config/Api";
import "./Tasks.css";

function Tasks() {
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
    assignedTo: "",
  });

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isTeamLead = ["superAdmin", "teamLead"].includes(user?.role?.name);

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
      // For teamLead, filter by their department
      const params = { isActive: true };
      if (user?.userType === "employee" && user?.department?._id) {
        params.department = user.department._id;
      }
      
      const response = await employeeAPI.getAll(params);
      if (response.data.success) {
        setEmployees(response.data.data);
        setFilteredEmployees(response.data.data);
        
        // Auto-select department for teamLead
        if (user?.userType === "employee" && user?.department?._id) {
          setFormData(prev => ({ ...prev, department: user.department._id }));
        }
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        // For teamLead, only show their department
        if (user?.userType === "employee" && user?.department) {
          setDepartments([user.department]);
        } else {
          setDepartments(response.data.data);
        }
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const handleDepartmentChange = (departmentId) => {
    setFormData({ ...formData, department: departmentId, assignedTo: "" });
    
    if (departmentId) {
      const filtered = employees.filter(emp => emp.department?._id === departmentId);
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (selectedTask) {
        await taskAPI.update(selectedTask._id, formData);
        alert("Task updated successfully!");
      } else {
        await taskAPI.create(formData);
        alert("Task created successfully!");
      }
      resetForm();
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error("Error submitting task:", error);
      alert(error.response?.data?.message || "Failed to submit task");
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
      alert("Failed to load task details");
    }
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      dueDate: task.dueDate.split("T")[0],
      department: task.department?._id || "",
      assignedTo: task.assignedTo._id,
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
      alert("Task deleted successfully!");
      fetchTasks();
      fetchStats();
    } catch (error) {
      console.error("Error deleting task:", error);
      alert(error.response?.data?.message || "Failed to delete task");
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
      alert("Failed to add comment");
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      priority: "Medium",
      dueDate: "",
      department: "",
      assignedTo: "",
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
                      📋 To Do
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
                            👤 {task.assignedTo?.name}
                          </div>
                          <div
                            className={`task-due-date ${
                              isOverdue(task.dueDate) ? "overdue" : ""
                            }`}
                          >
                            📅 {new Date(task.dueDate).toLocaleDateString()}
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
                      ⚙️ In Progress
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
                            👤 {task.assignedTo?.name}
                          </div>
                          <div
                            className={`task-due-date ${
                              isOverdue(task.dueDate) ? "overdue" : ""
                            }`}
                          >
                            📅 {new Date(task.dueDate).toLocaleDateString()}
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
                      ✅ Completed
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
                            👤 {task.assignedTo?.name}
                          </div>
                          <div className="task-due-date">
                            ✓ {new Date(task.completedAt).toLocaleDateString()}
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
                      <select
                        value={formData.assignedTo}
                        onChange={(e) =>
                          setFormData({ ...formData, assignedTo: e.target.value })
                        }
                        required
                      >
                        <option value="">Select Employee</option>
                        {filteredEmployees.map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.name} - {emp.employeeId} ({emp.position})
                          </option>
                        ))}
                      </select>
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
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Task Details - {selectedTask.taskId}</h2>
                  <button
                    className="close-btn"
                    onClick={() => setShowDetailModal(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="modal-body">
                  <div className="task-detail-header">
                    <div>
                      <div className="task-detail-title">{selectedTask.title}</div>
                      {selectedTask.description && (
                        <p style={{ color: "#64748b", marginTop: "8px" }}>
                          {selectedTask.description}
                        </p>
                      )}
                    </div>
                    {isTeamLead && (
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setShowDetailModal(false);
                          handleEditTask(selectedTask);
                        }}
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  <div className="task-detail-meta">
                    <div className="meta-item">
                      <span className="meta-label">Status</span>
                      <span className="meta-value" style={{ textTransform: "capitalize" }}>
                        {selectedTask.status.replace("-", " ")}
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Priority</span>
                      <span
                        className="meta-value"
                        style={{ color: getPriorityColor(selectedTask.priority) }}
                      >
                        {selectedTask.priority}
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Assigned To</span>
                      <span className="meta-value">
                        {selectedTask.assignedTo?.name} ({selectedTask.assignedTo?.employeeId})
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Department</span>
                      <span className="meta-value">{selectedTask.department?.name}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Assigned By</span>
                      <span className="meta-value">{selectedTask.assignedBy?.name}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Due Date</span>
                      <span className="meta-value">
                        {new Date(selectedTask.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                    {selectedTask.startedAt && (
                      <div className="meta-item">
                        <span className="meta-label">Started At</span>
                        <span className="meta-value">
                          {new Date(selectedTask.startedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {selectedTask.completedAt && (
                      <div className="meta-item">
                        <span className="meta-label">Completed At</span>
                        <span className="meta-value">
                          {new Date(selectedTask.completedAt).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Comments Section */}
                  <div className="comments-section">
                    <h3>Comments</h3>
                    {selectedTask.comments && selectedTask.comments.length > 0 ? (
                      selectedTask.comments.map((comment, index) => (
                        <div key={index} className="comment-item">
                          <div className="comment-header">
                            <span className="comment-author">
                              {comment.employee?.name || comment.user?.name || "Unknown"}
                              {comment.employee && ` (${comment.employee.employeeId})`}
                            </span>
                            <span className="comment-date">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="comment-text">{comment.comment}</p>
                        </div>
                      ))
                    ) : (
                      <p style={{ color: "#94a3b8", fontSize: 14 }}>
                        No comments yet
                      </p>
                    )}

                    <div className="add-comment">
                      <input
                        type="text"
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") handleAddComment();
                        }}
                      />
                      <button onClick={handleAddComment}>Post</button>
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
