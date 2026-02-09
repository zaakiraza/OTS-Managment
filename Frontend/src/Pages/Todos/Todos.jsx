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
    description: "",
  });
  const [filter, setFilter] = useState({
    search: "",
  });

  useEffect(() => {
    fetchTodos();
  }, [filter]);

  const fetchTodos = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filter.search) params.search = filter.search;

      const response = await todoAPI.getAll(params);
      if (response.data.success) {
        setTodos(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching notes:", error);
      toast.error(error.response?.data?.message || "Failed to fetch notes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const todoData = {
        description: formData.description,
      };

      if (editingTodo) {
        await todoAPI.update(editingTodo._id, todoData);
        toast.success("Note updated successfully!");
      } else {
        await todoAPI.create(todoData);
        toast.success("Note created successfully!");
      }

      setShowModal(false);
      setEditingTodo(null);
      setFormData({
        description: "",
      });
      fetchTodos();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error(error.response?.data?.message || "Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (todo) => {
    setEditingTodo(todo);
    setFormData({
      description: todo.description || "",
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;

    try {
      setLoading(true);
      await todoAPI.delete(id);
      toast.success("Note deleted successfully!");
      fetchTodos();
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error(error.response?.data?.message || "Failed to delete note");
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
      console.error("Error toggling note:", error);
      toast.error(error.response?.data?.message || "Failed to update note");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <SideBar />
      <div className="main-content">
        <div className="todos-page">
          <div className="page-header">
            <div>
              <h1>
                <i className="fas fa-list-check"></i> Personal Notes
              </h1>
              <p>Manage your personal notes and reminders</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <i className="fas fa-plus"></i> New Note
            </button>
          </div>

          <div className="filters-container">
            <div className="filter-group">
              <label>Search</label>
              <input
                type="text"
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                placeholder="Search notes..."
              />
            </div>
          </div>

          <div className="todos-grid">
            {loading ? (
              <div className="loading">Loading...</div>
            ) : todos.length === 0 ? (
              <div className="empty-state">
                <i className="fas fa-clipboard-list"></i>
                <p>No notes found. Create your first note!</p>
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
                        {todo.description || "Note"}
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
                description: "",
              });
            }}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>
                    <i className="fas fa-list-check"></i>{" "}
                    {editingTodo ? "Edit Note" : "New Note"}
                  </h2>
                  <button
                    className="close-btn"
                    onClick={() => {
                      setShowModal(false);
                      setEditingTodo(null);
                      setFormData({
                        description: "",
                      });
                    }}
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
                <form onSubmit={handleSubmit} className="modal-body">
                  <div className="form-group">
                    <label>
                      <i className="fas fa-align-left"></i> Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows="6"
                      placeholder="Write your note..."
                      required
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
                          description: "",
                        });
                      }}
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary" disabled={loading}>
                      {loading
                        ? "Saving..."
                        : editingTodo
                        ? "Update Note"
                        : "Create Note"}
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

