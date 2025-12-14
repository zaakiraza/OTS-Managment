import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import taskAPI from "../../Config/taskApi";
import "../Tasks/Tasks.css";

function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMyTasks();
  }, []);

  const fetchMyTasks = async () => {
    try {
      setLoading(true);
      const response = await taskAPI.getMyTasks();
      if (response.data.success) {
        setTasks(response.data.data);
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
      alert("Failed to load task details");
    }
  };

  const handleStatusChange = async (status) => {
    try {
      await taskAPI.updateStatus(selectedTask._id, status);
      alert("Task status updated successfully!");
      setSelectedTask({ ...selectedTask, status });
      fetchMyTasks();
    } catch (error) {
      console.error("Error updating status:", error);
      alert(error.response?.data?.message || "Failed to update status");
    }
  };

  // Check if current user is one of the assignees
  const user = (() => {
    try {
      const stored = localStorage.getItem("user");
      if (!stored || stored === "undefined") return {};
      return JSON.parse(stored);
    } catch { return {}; }
  })();
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
      alert("Failed to add comment");
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
            <h1>My Tasks</h1>
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
                          {isAssignedToMe(task) && <span style={{ marginLeft: '5px', color: '#10b981' }}>(You)</span>}
                        </div>
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
                          {isAssignedToMe(task) && <span style={{ marginLeft: '5px', color: '#10b981' }}>(You)</span>}
                        </div>
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
                          {isAssignedToMe(task) && <span style={{ marginLeft: '5px', color: '#10b981' }}>(You)</span>}
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
                      <span className="meta-label">Assigned By</span>
                      <span className="meta-value">{selectedTask.assignedBy?.name}</span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Assigned To</span>
                      <span className="meta-value">
                        {renderAssignees(selectedTask.assignedTo, true)}
                        {isAssignedToMe(selectedTask) && <span style={{ marginLeft: '5px', color: '#10b981' }}>(includes you)</span>}
                      </span>
                    </div>
                    <div className="meta-item">
                      <span className="meta-label">Department</span>
                      <span className="meta-value">{selectedTask.department?.name}</span>
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

                  {/* Status Update Actions */}
                  {!canUpdateTask(selectedTask) && (
                    <div style={{ padding: '12px', background: '#fef3c7', borderRadius: '8px', marginBottom: '16px', color: '#92400e' }}>
                      <i className="fas fa-info-circle"></i> This task is assigned to {renderAssignees(selectedTask.assignedTo)}. Only assigned employees or superAdmin can update the status.
                    </div>
                  )}
                  <div className="status-actions">
                    <button
                      className={`btn-status todo ${
                        selectedTask.status === "todo" ? "active" : ""
                      }`}
                      onClick={() => handleStatusChange("todo")}
                      disabled={selectedTask.status === "todo" || !canUpdateTask(selectedTask)}
                    >
                      <i className="fas fa-list"></i> To Do
                    </button>
                    <button
                      className={`btn-status in-progress ${
                        selectedTask.status === "in-progress" ? "active" : ""
                      }`}
                      onClick={() => handleStatusChange("in-progress")}
                      disabled={selectedTask.status === "in-progress" || !canUpdateTask(selectedTask)}
                    >
                      <i className="fas fa-spinner"></i> In Progress
                    </button>
                    <button
                      className={`btn-status completed ${
                        selectedTask.status === "completed" ? "active" : ""
                      }`}
                      onClick={() => handleStatusChange("completed")}
                      disabled={selectedTask.status === "completed" || !canUpdateTask(selectedTask)}
                    >
                      <i className="fas fa-check-circle"></i> Completed
                    </button>
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

export default MyTasks;
