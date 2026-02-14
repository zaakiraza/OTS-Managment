import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import taskAPI from "../../Config/taskApi";
import { useToast } from "../../Components/Common/Toast/Toast";
import "../Tasks/Tasks.css";

function MyTasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [myTasksOnly, setMyTasksOnly] = useState(false);

  // Get user shifts for department filter
  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
  
  const userShifts = user?.shifts || [];
  const hasMultipleShifts = userShifts.length > 1;

  useEffect(() => {
    fetchMyTasks();
  }, [departmentFilter, myTasksOnly]);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const params = {};
      if (departmentFilter) {
        params.department = departmentFilter;
      }
      const response = await taskAPI.getMyTasks(params);
      if (response.data.success) {
        let tasksData = response.data.data;
        
        // Filter to show only tasks assigned to logged-in user
        if (myTasksOnly) {
          tasksData = tasksData.filter((task) => {
            if (!task?.assignedTo) return false;
            const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
            return assignees.some(
              (emp) => emp?._id === user?._id || emp?._id?.toString() === user?._id?.toString()
            );
          });
        }
        
        setTasks(tasksData);
      }
    } catch (error) {
      console.error("Error fetching my tasks:", error);
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

  const handleStatusChange = async (status) => {
    try {
      await taskAPI.updateStatus(selectedTask._id, status);
      toast.success("Task status updated successfully!");
      setSelectedTask({ ...selectedTask, status });
      fetchMyTasks();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  // Check if current user is one of the assignees
  const isSuperAdmin = user?.role?.name === "superAdmin";
  
  const isAssignedToMe = (task) => {
    if (!task?.assignedTo) return false;
    // Handle both array (new) and single object (old) formats
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    return assignees.some(emp => 
      emp?._id === user?._id || 
      emp?._id?.toString() === user?._id?.toString()
    );
  };

  // SuperAdmin can update any task, assigned employees can update their tasks
  const canUpdateTask = (task) => {
    return isSuperAdmin || isAssignedToMe(task);
  };

  // Helper to render multiple assignees
  const renderAssignees = (assignedTo, showFull = false) => {
    if (!assignedTo) return "Unassigned";
    
    // Handle both array and single object
    const assignees = Array.isArray(assignedTo) ? assignedTo : [assignedTo];
    
    if (assignees.length === 0) return "Unassigned";
    
    if (showFull) {
      return assignees.map(emp => `${emp?.name || 'Unknown'} (${emp?.employeeId || ''})`).join(", ");
    }
    
    if (assignees.length === 1) {
      return assignees[0]?.name || "Unknown";
    }
    
    return `${assignees[0]?.name} +${assignees.length - 1} more`;
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const response = await taskAPI.addComment(selectedTask._id, newComment);
      if (response.data.success) {
        setSelectedTask(response.data.data);
        setNewComment("");
        fetchMyTasks();
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
    }
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

  const isTaskOverdue = (task) => {
    if (!task?.dueDate) return false;
    return new Date(task.dueDate) < new Date() && task.status !== "completed";
  };

  const groupedTasks = {
    todo: tasks.filter((t) => t.status === "todo"),
    "in-progress": tasks.filter((t) => t.status === "in-progress"),
    completed: tasks.filter((t) => t.status === "completed"),
  };

  const stats = {
    total: tasks.length,
    todo: groupedTasks.todo.length,
    inProgress: groupedTasks["in-progress"].length,
    completed: groupedTasks.completed.length,
    overdue: tasks.filter(
      (t) => t.status !== "completed" && new Date(t.dueDate) < new Date()
    ).length,
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="tasks-page">
          {/* Page Header */}
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">
                <i className="fas fa-clipboard-list"></i>
              </div>
              <div>
                <h1>My Tasks</h1>
                <p>Here Your Head will assign tasks to you.</p>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-container">
            <div className="stat-card">
              <h3>Total Tasks</h3>
              <div className="value">{stats.total}</div>
            </div>
            <div className="stat-card">
              <h3>To Do</h3>
              <div className="value" style={{ color: "#94a3b8" }}>
                {stats.todo}
              </div>
            </div>
            <div className="stat-card">
              <h3>In Progress</h3>
              <div className="value" style={{ color: "#f59e0b" }}>
                {stats.inProgress}
              </div>
            </div>
            <div className="stat-card">
              <h3>Completed</h3>
              <div className="value" style={{ color: "#10b981" }}>
                {stats.completed}
              </div>
            </div>
            <div className="stat-card">
              <h3>Overdue</h3>
              <div className="value" style={{ color: "#ef4444" }}>
                {stats.overdue}
              </div>
            </div>
          </div>

          {/* Filters Section */}
          <div className="filters-section" style={{ marginBottom: '20px' }}>
            {hasMultipleShifts && (
              <div className="filter-group">
                <label>Filter by Department:</label>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="filter-select"
                >
                  <option value="">All My Departments</option>
                  {userShifts.map((shift) => (
                    <option key={shift.department?._id || shift.department} value={shift.department?._id || shift.department}>
                      {shift.department?.name || `Department ${shift.department}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            <div className="filter-group">
              <label>Assigned To:</label>
              <select
                value={myTasksOnly ? "me" : "all"}
                onChange={(e) => setMyTasksOnly(e.target.value === "me")}
                className="filter-select"
              >
                <option value="all">All Tasks</option>
                <option value="me">My Tasks Only</option>
              </select>
            </div>
          </div>

          {/* Kanban Board */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px" }}>Loading...</div>
          ) : (
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
                      className={`task-card priority-${task.priority.toLowerCase()}${isTaskOverdue(task) ? " overdue" : ""}`}
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
                          {isAssignedToMe(task) && <span style={{ marginLeft: '5px', color: '#10b981' }}>(You)</span>}
                        </div>
                        {task.assignedBy && (
                          <div className="task-assignee" style={{ fontSize: '0.85em', color: '#64748b' }}>
                            <i className="fas fa-user-check"></i> Assigned by: {task.assignedBy.name}
                          </div>
                        )}
                        <div
                          className={`task-due-date ${
                            new Date(task.dueDate) < new Date() ? "overdue" : ""
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
                      className={`task-card priority-${task.priority.toLowerCase()}${isTaskOverdue(task) ? " overdue" : ""}`}
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
                          {isAssignedToMe(task) && <span style={{ marginLeft: '5px', color: '#10b981' }}>(You)</span>}
                        </div>
                        {task.assignedBy && (
                          <div className="task-assignee" style={{ fontSize: '0.85em', color: '#64748b' }}>
                            <i className="fas fa-user-check"></i> Assigned by: {task.assignedBy.name}
                          </div>
                        )}
                        <div
                          className={`task-due-date ${
                            new Date(task.dueDate) < new Date() ? "overdue" : ""
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
                      className={`task-card priority-${task.priority.toLowerCase()}${isTaskOverdue(task) ? " overdue" : ""}`}
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
                          {isAssignedToMe(task) && <span style={{ marginLeft: '5px', color: '#10b981' }}>(You)</span>}
                        </div>
                        {task.assignedBy && (
                          <div className="task-assignee" style={{ fontSize: '0.85em', color: '#64748b' }}>
                            <i className="fas fa-user-check"></i> Assigned by: {task.assignedBy.name}
                          </div>
                        )}
                        <div className="task-due-date">
                          <i className="fas fa-check"></i> {new Date(task.completedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
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
                  </div>

                  {/* Status Update Section */}
                  {!canUpdateTask(selectedTask) && (
                    <div className="permission-notice">
                      <i className="fas fa-info-circle"></i> 
                      <span>This task is assigned to {renderAssignees(selectedTask.assignedTo)}. Only assigned employees or superAdmin can update the status.</span>
                    </div>
                  )}
                  
                  <div className="status-section">
                    <h4><i className="fas fa-sync-alt"></i> Update Status</h4>
                    <div className="status-buttons">
                      <button
                        className={`status-btn ${selectedTask.status === "todo" ? "active" : ""}`}
                        onClick={() => handleStatusChange("todo")}
                        disabled={selectedTask.status === "todo" || !canUpdateTask(selectedTask)}
                      >
                        <i className="fas fa-list"></i>
                        <span>To Do</span>
                      </button>
                      <button
                        className={`status-btn in-progress ${selectedTask.status === "in-progress" ? "active" : ""}`}
                        onClick={() => handleStatusChange("in-progress")}
                        disabled={selectedTask.status === "in-progress" || !canUpdateTask(selectedTask)}
                      >
                        <i className="fas fa-spinner"></i>
                        <span>In Progress</span>
                      </button>
                      <button
                        className={`status-btn completed ${selectedTask.status === "completed" ? "active" : ""}`}
                        onClick={() => handleStatusChange("completed")}
                        disabled={selectedTask.status === "completed" || !canUpdateTask(selectedTask)}
                      >
                        <i className="fas fa-check-circle"></i>
                        <span>Completed</span>
                      </button>
                    </div>
                  </div>

                  {/* Task Meta Grid */}
                  <div className="task-meta-grid">
                    <div className="meta-card assignees-card">
                      <div className="meta-icon"><i className="fas fa-user"></i></div>
                      <div className="meta-content">
                        <span className="meta-label">Assigned To</span>
                        {(() => {
                          const assignees = Array.isArray(selectedTask.assignedTo) ? selectedTask.assignedTo : [selectedTask.assignedTo];
                          return (
                            <div className="assignees-list">
                              {assignees.map((emp, idx) => (
                                <div key={idx} className="assignee-item">
                                  <i className="fas fa-user-circle"></i>
                                  <span className="assignee-name">{emp?.name || 'Unknown'}</span>
                                  <span className="assignee-id">{emp?.employeeId || ''}</span>
                                  {emp._id === user?._id && <span className="you-badge">(You)</span>}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
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
                      <div className="meta-icon" style={{ background: isOverdue(selectedTask.dueDate) ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' : undefined }}>
                        <i className="fas fa-calendar-alt"></i>
                      </div>
                      <div className="meta-content">
                        <span className="meta-label">Due Date</span>
                        <span className="meta-value" style={{ color: isOverdue(selectedTask.dueDate) ? '#ef4444' : undefined }}>
                          {new Date(selectedTask.dueDate).toLocaleDateString()}
                          {isOverdue(selectedTask.dueDate) && <span className="overdue-badge">Overdue</span>}
                        </span>
                      </div>
                    </div>
                    {selectedTask.startedAt && (
                      <div className="meta-card">
                        <div className="meta-icon" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                          <i className="fas fa-play-circle"></i>
                        </div>
                        <div className="meta-content">
                          <span className="meta-label">Started At</span>
                          <span className="meta-value">{new Date(selectedTask.startedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                    {selectedTask.completedAt && (
                      <div className="meta-card">
                        <div className="meta-icon" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                          <i className="fas fa-check-double"></i>
                        </div>
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

export default MyTasks;
