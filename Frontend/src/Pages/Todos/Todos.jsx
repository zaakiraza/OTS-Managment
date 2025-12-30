import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import { todoAPI } from "../../Config/Api";
import { useToast } from "../../Components/Common/Toast/Toast";
import "./Todos.css";

function Todos() {
  const toast = useToast();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "pending",
    dueDate: "",
    tags: "",
  });
  const [filter, setFilter] = useState({
    status: "",
    priority: "",
    search: "",
  });

  useEffect(() => {
    fetchTodos();
  }, [filter]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.priority) params.priority = filter.priority;
      if (filter.search) params.search = filter.search;

      const response = await todoAPI.getAll(params);
      if (response.data.success) {
        setTodos(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching todos:", error);
      toast.error(error.response?.data?.message || "Failed to fetch todos");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const todoData = {
        ...formData,
        tags: formData.tags
          ? formData.tags.split(",").map((tag) => tag.trim())
          : [],
      };

      if (editingTodo) {
        await todoAPI.update(editingTodo._id, todoData);
        toast.success("Todo updated successfully!");
      } else {
        await todoAPI.create(todoData);
        toast.success("Todo created successfully!");
      }

      setShowModal(false);
      setEditingTodo(null);
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "pending",
        dueDate: "",
        tags: "",
      });
      fetchTodos();
    } catch (error) {
      console.error("Error saving todo:", error);
      toast.error(error.response?.data?.message || "Failed to save todo");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (todo) => {
    setEditingTodo(todo);
    setFormData({
      title: todo.title,
      description: todo.description || "",
      priority: todo.priority,
      status: todo.status,
      dueDate: todo.dueDate
        ? new Date(todo.dueDate).toISOString().split("T")[0]
        : "",
      tags: todo.tags ? todo.tags.join(", ") : "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this todo?")) return;

    try {
      setLoading(true);
      await todoAPI.delete(id);
      toast.success("Todo deleted successfully!");
      fetchTodos();
    } catch (error) {
      console.error("Error deleting todo:", error);
      toast.error(error.response?.data?.message || "Failed to delete todo");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      setLoading(true);
      await todoAPI.toggleStatus(id);
      fetchTodos();
    } catch (error) {
      console.error("Error toggling todo:", error);
      toast.error(error.response?.data?.message || "Failed to update todo");
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: "#10b981",
      medium: "#f59e0b",
      high: "#ef4444",
    };
    return colors[priority] || "#6b7280";
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "#6b7280",
      "in-progress": "#3b82f6",
      completed: "#10b981",
    };
    return colors[status] || "#6b7280";
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return due < today;
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="todos-page">
          <div className="page-header">
            <div>
              <h1>
                <i className="fas fa-list-check"></i> My Todos
              </h1>
              <p>Manage your personal tasks and reminders</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <i className="fas fa-plus"></i> New Todo
            </button>
          </div>

          <div className="filters-container">
            <div className="filter-group">
              <label>Status</label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Priority</label>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
              >
                <option value="">All Priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                placeholder="Search todos..."
              />
            </div>
          </div>

          <div className="todos-grid">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : todos.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-clipboard-list"></i>
                <p>No todos found. Create your first todo!</p>
              </div>
            ) : (
              todos.map((todo) => (
                <div key={todo._id} className="todo-card">
                  <div className="todo-header">
                    <div className="todo-title-row">
                      <input
                        type="checkbox"
                        checked={todo.status === "completed"}
                        onChange={() => handleToggleStatus(todo._id)}
                        className="todo-checkbox"
                      />
                      <h3 className={todo.status === "completed" ? "completed" : ""}>
                        {todo.title}
                      </h3>
                    </div>
                    <div className="todo-actions">
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(todo)}
                        title="Edit"
                      >
                        <i className="fas fa-edit"></i>
                      </button>
                      <button
                        className="btn-icon delete"
                        onClick={() => handleDelete(todo._id)}
                        title="Delete"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                  {todo.description && (
                    <p className="todo-description">{todo.description}</p>
                  )}
                  <div className="todo-footer">
                    <div className="todo-meta">
                      <span
                        className="priority-badge"
                        style={{ background: getPriorityColor(todo.priority) }}
                      >
                        {todo.priority}
                      </span>
                      <span
                        className="status-badge"
                        style={{ background: getStatusColor(todo.status) }}
                      >
                        {todo.status}
                      </span>
                      {todo.dueDate && (
                        <span
                          className={`due-date ${
                            isOverdue(todo.dueDate) && todo.status !== "completed"
                              ? "overdue"
                              : ""
                          }`}
                        >
                          <i className="fas fa-calendar"></i>
                          {new Date(todo.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {todo.tags && todo.tags.length > 0 && (
                      <div className="todo-tags">
                        {todo.tags.map((tag, index) => (
                          <span key={index} className="tag">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Create/Edit Todo Modal */}
          {showModal && (
            <div className="modal-overlay" onClick={() => {
              setShowModal(false);
              setEditingTodo(null);
              setFormData({
                title: "",
                description: "",
                priority: "medium",
                status: "pending",
                dueDate: "",
                tags: "",
              });
            }}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>
                    <i className="fas fa-list-check"></i>{" "}
                    {editingTodo ? "Edit Todo" : "New Todo"}
                  </h2>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setShowModal(false);
                      setEditingTodo(null);
                      setFormData({
                        title: "",
                        description: "",
                        priority: "medium",
                        status: "pending",
                        dueDate: "",
                        tags: "",
                      });
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                  <div className="form-group">
                    <label>
                      <i className="fas fa-heading"></i> Title <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      placeholder="Enter todo title"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-align-left"></i> Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows="4"
                      placeholder="Add details..."
                    />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>
                        <i className="fas fa-exclamation-circle"></i> Priority
                      </label>
                      <select
                        value={formData.priority}
                        onChange={(e) =>
                          setFormData({ ...formData, priority: e.target.value })
                        }
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>
                        <i className="fas fa-tasks"></i> Status
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) =>
                          setFormData({ ...formData, status: e.target.value })
                        }
                      >
                        <option value="pending">Pending</option>
                        <option value="in-progress">In Progress</option>
                        <option value="completed">Completed</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-calendar"></i> Due Date
                    </label>
                    <input
                      type="date"
                      value={formData.dueDate}
                      onChange={(e) =>
                        setFormData({ ...formData, dueDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-tags"></i> Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) =>
                        setFormData({ ...formData, tags: e.target.value })
                      }
                      placeholder="work, personal, urgent"
                    />
                  </div>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setShowModal(false);
                        setEditingTodo(null);
                        setFormData({
                          title: "",
                          description: "",
                          priority: "medium",
                          status: "pending",
                          dueDate: "",
                          tags: "",
                        });
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading
                        ? "Saving..."
                        : editingTodo
                        ? "Update Todo"
                        : "Create Todo"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Todos;

