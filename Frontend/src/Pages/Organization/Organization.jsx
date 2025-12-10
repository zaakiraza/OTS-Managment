import { useState, useEffect } from "react";
import SideBar from "../../Components/SideBar/SideBar";
import {
  campusAPI,
  buildingAPI,
  floorAPI,
  roomAPI,
  departmentAPI,
  employeeAPI,
} from "../../Config/Api";
import "./Organization.css";

function Organization() {
  const [activeTab, setActiveTab] = useState("campus");
  const [loading, setLoading] = useState(false);

  // Campus State
  const [campuses, setCampuses] = useState([]);
  const [showCampusModal, setShowCampusModal] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState(null);
  const [campusForm, setCampusForm] = useState({
    name: "",
    code: "",
    city: "",
    country: "Pakistan",
    address: "",
    description: "",
  });

  // Building State
  const [buildings, setBuildings] = useState([]);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [buildingForm, setBuildingForm] = useState({
    campus: "",
    name: "",
    code: "",
    description: "",
  });
  const [campusFilter, setCampusFilter] = useState("");

  // Floor State
  const [floors, setFloors] = useState([]);
  const [showFloorModal, setShowFloorModal] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [floorForm, setFloorForm] = useState({
    building: "",
    floorNumber: "",
    name: "",
    code: "",
    description: "",
  });
  const [buildingFilter, setBuildingFilter] = useState("");

  // Room State
  const [rooms, setRooms] = useState([]);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomForm, setRoomForm] = useState({
    floor: "",
    roomNumber: "",
    name: "",
    code: "",
    roomType: "Office",
    description: "",
  });
  const [floorFilter, setFloorFilter] = useState("");

  // Department State
  const [departments, setDepartments] = useState([]);
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [departmentForm, setDepartmentForm] = useState({
    name: "",
    room: "",
    floor: "",
    description: "",
    teamLead: "",
    checkInMinutes: "15",
    checkOutMinutes: "15",
  });
  const [roomFilter, setRoomFilter] = useState("");

  // Employee State
  const [employees, setEmployees] = useState([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    employeeId: "",
    biometricId: "",
    department: "",
    email: "",
    phone: "",
    cnic: "",
    position: "",
    monthlySalary: "",
    joiningDate: "",
    checkInTime: "09:00",
    checkOutTime: "17:00",
    weeklyOffs: ["Saturday", "Sunday"],
  });
  const [departmentFilter, setDepartmentFilter] = useState("");

  const roomTypes = [
    "Office",
    "Conference Room",
    "Meeting Room",
    "Server Room",
    "Washroom",
    "Sitting Area",
    "Other",
  ];

  useEffect(() => {
    fetchData();
  }, [
    activeTab,
    campusFilter,
    buildingFilter,
    floorFilter,
    roomFilter,
    departmentFilter,
  ]);

  const fetchData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case "campus":
          await fetchCampuses();
          break;
        case "building":
          await fetchBuildings();
          await fetchCampuses(); // For dropdown
          break;
        case "floor":
          await fetchFloors();
          await fetchBuildings(); // For dropdown
          break;
        case "room":
          await fetchRooms();
          await fetchFloors(); // For dropdown
          break;
        case "department":
          await fetchDepartments();
          await fetchRooms(); // For dropdown
          await fetchFloors(); // For dropdown
          await fetchEmployees(); // For team lead dropdown
          break;
        case "employee":
          await fetchEmployees();
          await fetchDepartments(); // For dropdown
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCampuses = async () => {
    try {
      const response = await campusAPI.getAll();
      if (response.data.success) {
        setCampuses(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching campuses:", error);
    }
  };

  const fetchBuildings = async () => {
    try {
      const params = campusFilter ? { campus: campusFilter } : {};
      const response = await buildingAPI.getAll(params);
      if (response.data.success) {
        setBuildings(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching buildings:", error);
    }
  };

  const fetchFloors = async () => {
    try {
      const params = buildingFilter ? { building: buildingFilter } : {};
      const response = await floorAPI.getAll(params);
      if (response.data.success) {
        setFloors(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching floors:", error);
    }
  };

  const fetchRooms = async () => {
    try {
      // Only apply floor filter when on the "room" tab
      const params = (activeTab === "room" && floorFilter) ? { floor: floorFilter } : {};
      const response = await roomAPI.getAll(params);
      if (response.data.success) {
        setRooms(response.data.data);
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await departmentAPI.getAll();
      if (response.data.success) {
        const depts = response.data.data;
        setDepartments(
          roomFilter ? depts.filter((d) => d.room?._id === roomFilter) : depts
        );
      }
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await employeeAPI.getAll();
      if (response.data.success) {
        const emps = response.data.data;
        setEmployees(
          departmentFilter
            ? emps.filter((e) => e.department?._id === departmentFilter)
            : emps
        );
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  // Campus Handlers
  const handleCampusSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Auto-generate code if empty
      const submissionData = { ...campusForm };
      if (!submissionData.code || submissionData.code.trim() === "") {
        // Generate code from name (first 3 letters + random number)
        const namePrefix = submissionData.name
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Z]/g, "");
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        submissionData.code = `${namePrefix}${randomNum}`;
      }
      
      if (selectedCampus) {
        await campusAPI.update(selectedCampus._id, submissionData);
        alert("Campus updated successfully!");
      } else {
        await campusAPI.create(submissionData);
        alert("Campus created successfully!");
      }
      setShowCampusModal(false);
      resetCampusForm();
      fetchCampuses();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save campus");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCampus = (campus) => {
    setSelectedCampus(campus);
    setCampusForm({
      name: campus.name,
      code: campus.code,
      city: campus.city,
      country: campus.country || "Pakistan",
      address: campus.address || "",
      description: campus.description || "",
    });
    setShowCampusModal(true);
  };

  const handleDeleteCampus = async (id) => {
    if (!confirm("Are you sure you want to deactivate this campus?")) return;
    try {
      await campusAPI.delete(id);
      alert("Campus deactivated successfully!");
      fetchCampuses();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete campus");
    }
  };

  const resetCampusForm = () => {
    setCampusForm({
      name: "",
      code: "",
      city: "",
      country: "Pakistan",
      address: "",
      description: "",
    });
    setSelectedCampus(null);
  };

  // Building Handlers
  const handleBuildingSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Auto-generate code if empty
      const submissionData = { ...buildingForm };
      if (!submissionData.code || submissionData.code.trim() === "") {
        // Generate code from name (first 3 letters + random number)
        const namePrefix = submissionData.name
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Z]/g, "");
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        submissionData.code = `${namePrefix}${randomNum}`;
      }
      
      if (selectedBuilding) {
        await buildingAPI.update(selectedBuilding._id, submissionData);
        alert("Building updated successfully!");
      } else {
        await buildingAPI.create(submissionData);
        alert("Building created successfully!");
      }
      setShowBuildingModal(false);
      resetBuildingForm();
      fetchBuildings();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save building");
    } finally {
      setLoading(false);
    }
  };

  const handleEditBuilding = (building) => {
    setSelectedBuilding(building);
    setBuildingForm({
      campus: building.campus._id,
      name: building.name,
      code: building.code,
      description: building.description || "",
    });
    setShowBuildingModal(true);
  };

  const handleDeleteBuilding = async (id) => {
    if (!confirm("Are you sure you want to deactivate this building?")) return;
    try {
      await buildingAPI.delete(id);
      alert("Building deactivated successfully!");
      fetchBuildings();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete building");
    }
  };

  const resetBuildingForm = () => {
    setBuildingForm({
      campus: "",
      name: "",
      code: "",
      description: "",
    });
    setSelectedBuilding(null);
  };

  // Floor Handlers
  const handleFloorSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Auto-generate code if empty
      const submissionData = { ...floorForm };
      if (!submissionData.code || submissionData.code.trim() === "") {
        // Generate code from name or floor number (first 3 letters + random number)
        const nameSource = submissionData.name || `Floor${submissionData.floorNumber}`;
        const namePrefix = nameSource
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Z]/g, "");
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        submissionData.code = `${namePrefix}${randomNum}`;
      }
      
      if (selectedFloor) {
        await floorAPI.update(selectedFloor._id, submissionData);
        alert("Floor updated successfully!");
      } else {
        await floorAPI.create(submissionData);
        alert("Floor created successfully!");
      }
      setShowFloorModal(false);
      resetFloorForm();
      fetchFloors();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save floor");
    } finally {
      setLoading(false);
    }
  };

  const handleEditFloor = (floor) => {
    setSelectedFloor(floor);
    setFloorForm({
      building: floor.building._id,
      floorNumber: floor.floorNumber,
      name: floor.name,
      code: floor.code,
      description: floor.description || "",
    });
    setShowFloorModal(true);
  };

  const handleDeleteFloor = async (id) => {
    if (!confirm("Are you sure you want to deactivate this floor?")) return;
    try {
      await floorAPI.delete(id);
      alert("Floor deactivated successfully!");
      fetchFloors();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete floor");
    }
  };

  const resetFloorForm = () => {
    setFloorForm({
      building: "",
      floorNumber: "",
      name: "",
      code: "",
      description: "",
    });
    setSelectedFloor(null);
  };

  // Room Handlers
  const handleRoomSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Auto-generate code if empty
      const submissionData = { ...roomForm };
      if (!submissionData.code || submissionData.code.trim() === "") {
        // Generate code from name or room number (first 3 letters + random number)
        const nameSource = submissionData.name || `Room${submissionData.roomNumber}`;
        const namePrefix = nameSource
          .substring(0, 3)
          .toUpperCase()
          .replace(/[^A-Z]/g, "");
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        submissionData.code = `${namePrefix}${randomNum}`;
      }
      
      if (selectedRoom) {
        await roomAPI.update(selectedRoom._id, submissionData);
        alert("Room updated successfully!");
      } else {
        await roomAPI.create(submissionData);
        alert("Room created successfully!");
      }
      setShowRoomModal(false);
      resetRoomForm();
      fetchRooms();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save room");
    } finally {
      setLoading(false);
    }
  };

  const handleEditRoom = (room) => {
    setSelectedRoom(room);
    setRoomForm({
      floor: room.floor._id,
      roomNumber: room.roomNumber,
      name: room.name,
      code: room.code,
      roomType: room.roomType,
      description: room.description || "",
    });
    setShowRoomModal(true);
  };

  const handleDeleteRoom = async (id) => {
    if (!confirm("Are you sure you want to deactivate this room?")) return;
    try {
      await roomAPI.delete(id);
      alert("Room deactivated successfully!");
      fetchRooms();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete room");
    }
  };

  const resetRoomForm = () => {
    setRoomForm({
      floor: "",
      roomNumber: "",
      name: "",
      code: "",
      roomType: "Office",
      description: "",
    });
    setSelectedRoom(null);
  };

  // Department Handlers
  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Prepare department data with leverageTime object
      const departmentData = {
        ...departmentForm,
        leverageTime: {
          checkInMinutes: parseInt(departmentForm.checkInMinutes) || 15,
          checkOutMinutes: parseInt(departmentForm.checkOutMinutes) || 15,
        }
      };
      delete departmentData.checkInMinutes;
      delete departmentData.checkOutMinutes;
      
      // Remove teamLead if empty
      if (!departmentData.teamLead) {
        delete departmentData.teamLead;
      }
      
      if (selectedDepartment) {
        await departmentAPI.update(selectedDepartment._id, departmentData);
        alert("Department updated successfully!");
      } else {
        await departmentAPI.create(departmentData);
        alert("Department created successfully!");
      }
      setShowDepartmentModal(false);
      resetDepartmentForm();
      fetchDepartments();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save department");
    } finally {
      setLoading(false);
    }
  };

  const handleEditDepartment = (department) => {
    setSelectedDepartment(department);
    setDepartmentForm({
      floor: department.floor?._id || "",
      room: department.room?._id || "",
      name: department.name,
      description: department.description || "",
      teamLead: department.teamLead?._id || "",
      checkInMinutes: department.leverageTime?.checkInMinutes?.toString() || "15",
      checkOutMinutes: department.leverageTime?.checkOutMinutes?.toString() || "15",
    });
    setShowDepartmentModal(true);
  };

  const handleDeleteDepartment = async (id) => {
    if (!confirm("Are you sure you want to deactivate this department?"))
      return;
    try {
      await departmentAPI.delete(id);
      alert("Department deactivated successfully!");
      fetchDepartments();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete department");
    }
  };

  const resetDepartmentForm = () => {
    setDepartmentForm({
      name: "",
      room: "",
      floor: "",
      description: "",
      teamLead: "",
      checkInMinutes: "15",
      checkOutMinutes: "15",
    });
    setSelectedDepartment(null);
  };

  // Employee Handlers
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      
      // Prepare employee data with salary and workSchedule objects
      const employeeData = {
        ...employeeForm,
        salary: {
          monthlySalary: employeeForm.monthlySalary,
          currency: "PKR"
        },
        workSchedule: {
          checkInTime: employeeForm.checkInTime,
          checkOutTime: employeeForm.checkOutTime,
          weeklyOffs: employeeForm.weeklyOffs
        }
      };
      delete employeeData.monthlySalary;
      delete employeeData.checkInTime;
      delete employeeData.checkOutTime;
      delete employeeData.weeklyOffs;
      
      if (selectedEmployee) {
        await employeeAPI.update(selectedEmployee._id, employeeData);
        alert("Employee updated successfully!");
      } else {
        await employeeAPI.create(employeeData);
        alert("Employee created successfully!");
      }
      setShowEmployeeModal(false);
      resetEmployeeForm();
      fetchEmployees();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save employee");
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployee = (employee) => {
    setSelectedEmployee(employee);
    setEmployeeForm({
      department: employee.department?._id || "",
      employeeId: employee.employeeId,
      biometricId: employee.biometricId || "",
      name: employee.name,
      email: employee.email,
      phone: employee.phone || "",
      cnic: employee.cnic || "",
      position: employee.position,
      monthlySalary: employee.salary?.monthlySalary || "",
      joiningDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : "",
      checkInTime: employee.workSchedule?.checkInTime || "09:00",
      checkOutTime: employee.workSchedule?.checkOutTime || "17:00",
      weeklyOffs: employee.workSchedule?.weeklyOffs || ["Saturday", "Sunday"],
    });
    setShowEmployeeModal(true);
  };

  const handleDeleteEmployee = async (id) => {
    if (!confirm("Are you sure you want to deactivate this employee?")) return;
    try {
      await employeeAPI.delete(id);
      alert("Employee deactivated successfully!");
      fetchEmployees();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to delete employee");
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      name: "",
      employeeId: "",
      biometricId: "",
      department: "",
      email: "",
      phone: "",
      cnic: "",
      position: "",
      monthlySalary: "",
      joiningDate: "",
      checkInTime: "09:00",
      checkOutTime: "17:00",
      weeklyOffs: ["Saturday", "Sunday"],
    });
    setSelectedEmployee(null);
  };

  return (
    <div className="organization-page">
      <SideBar />
      <div className="organization-content">
        <div className="organization-header">
          <h1>🏢 Organization Management</h1>
        </div>

        <div className="tabs-container">
          <button
            className={`tab-button ${activeTab === "campus" ? "active" : ""}`}
            onClick={() => setActiveTab("campus")}
          >
            🌍 Campus
          </button>
          <button
            className={`tab-button ${activeTab === "building" ? "active" : ""}`}
            onClick={() => setActiveTab("building")}
          >
            🏛️ Buildings
          </button>
          <button
            className={`tab-button ${activeTab === "floor" ? "active" : ""}`}
            onClick={() => setActiveTab("floor")}
          >
            📐 Floors
          </button>
          <button
            className={`tab-button ${activeTab === "room" ? "active" : ""}`}
            onClick={() => setActiveTab("room")}
          >
            🚪 Rooms
          </button>
          <button
            className={`tab-button ${
              activeTab === "department" ? "active" : ""
            }`}
            onClick={() => setActiveTab("department")}
          >
            🏢 Departments
          </button>
          <button
            className={`tab-button ${activeTab === "employee" ? "active" : ""}`}
            onClick={() => setActiveTab("employee")}
          >
            👨‍💼 Employees
          </button>
        </div>

        {/* Campus Tab */}
        {activeTab === "campus" && (
          <div className="tab-content">
            <div className="content-header">
              <h2>Campus Management</h2>
              <button
                className="btn-add"
                onClick={() => {
                  resetCampusForm();
                  setShowCampusModal(true);
                }}
              >
                ➕ Add Campus
              </button>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : campuses.length === 0 ? (
              <div className="empty-state">
                <div>🏢</div>
                <h3>No Campuses Found</h3>
                <p>Start by adding your first campus</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>City</th>
                    <th>Country</th>
                    <th>Total Area</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campuses.map((campus) => (
                    <tr key={campus._id}>
                      <td>
                        <strong>{campus.code}</strong>
                      </td>
                      <td>{campus.name}</td>
                      <td>{campus.city}</td>
                      <td>{campus.country}</td>
                      <td>
                        {campus.totalArea ? `${campus.totalArea} sq ft` : "-"}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            campus.isActive ? "active" : "inactive"
                          }`}
                        >
                          {campus.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => handleEditCampus(campus)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteCampus(campus._id)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Building Tab - Will continue in next message due to length */}

        {/* Building Tab */}
        {activeTab === "building" && (
          <div className="tab-content">
            <div className="content-header">
              <h2>Building Management</h2>
              <button
                className="btn-add"
                onClick={() => {
                  resetBuildingForm();
                  setShowBuildingModal(true);
                }}
              >
                ➕ Add Building
              </button>
            </div>

            <div className="filter-section">
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
              >
                <option value="">All Campuses</option>
                {campuses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : buildings.length === 0 ? (
              <div className="empty-state">
                <div>🏛️</div>
                <h3>No Buildings Found</h3>
                <p>Add buildings to your campus</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Campus</th>
                    <th>Total Floors</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {buildings.map((building) => (
                    <tr key={building._id}>
                      <td>
                        <strong>{building.code}</strong>
                      </td>
                      <td>{building.name}</td>
                      <td>{building.campus?.name || "-"}</td>
                      <td>{building.totalFloors || "-"}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            building.isActive ? "active" : "inactive"
                          }`}
                        >
                          {building.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => handleEditBuilding(building)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteBuilding(building._id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Floor Tab */}
        {activeTab === "floor" && (
          <div className="tab-content">
            <div className="content-header">
              <h2>Floor Management</h2>
              <button
                className="btn-add"
                onClick={() => {
                  resetFloorForm();
                  setShowFloorModal(true);
                }}
              >
                ➕ Add Floor
              </button>
            </div>

            <div className="filter-section">
              <select
                value={buildingFilter}
                onChange={(e) => setBuildingFilter(e.target.value)}
              >
                <option value="">All Buildings</option>
                {buildings.map((b) => (
                  <option key={b._id} value={b._id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : floors.length === 0 ? (
              <div className="empty-state">
                <div>📐</div>
                <h3>No Floors Found</h3>
                <p>Add floors to your building</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Floor #</th>
                    <th>Name</th>
                    <th>Building</th>
                    <th>Capacity</th>
                    <th>Total Area</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {floors.map((floor) => (
                    <tr key={floor._id}>
                      <td>
                        <strong>{floor.floorNumber}</strong>
                      </td>
                      <td>{floor.name}</td>
                      <td>{floor.building?.name || "-"}</td>
                      <td>{floor.capacity || "-"}</td>
                      <td>
                        {floor.totalArea ? `${floor.totalArea} sq ft` : "-"}
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            floor.isActive ? "active" : "inactive"
                          }`}
                        >
                          {floor.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => handleEditFloor(floor)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteFloor(floor._id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Room Tab */}
        {activeTab === "room" && (
          <div className="tab-content">
            <div className="content-header">
              <h2>Room Management</h2>
              <button
                className="btn-add"
                onClick={() => {
                  resetRoomForm();
                  setShowRoomModal(true);
                }}
              >
                ➕ Add Room
              </button>
            </div>

            <div className="filter-section">
              <select
                value={floorFilter}
                onChange={(e) => setFloorFilter(e.target.value)}
              >
                <option value="">All Floors</option>
                {floors.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name} - Floor {f.floorNumber}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : rooms.length === 0 ? (
              <div className="empty-state">
                <div>🚪</div>
                <h3>No Rooms Found</h3>
                <p>Add rooms to your floor</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Room #</th>
                    <th>Name</th>
                    <th>Floor</th>
                    <th>Type</th>
                    <th>Capacity</th>
                    <th>Area</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((room) => (
                    <tr key={room._id}>
                      <td>
                        <strong>{room.roomNumber}</strong>
                      </td>
                      <td>{room.name}</td>
                      <td>{room.floor?.name || "-"}</td>
                      <td>{room.roomType}</td>
                      <td>{room.capacity || "-"}</td>
                      <td>{room.area ? `${room.area} sq ft` : "-"}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            room.isActive ? "active" : "inactive"
                          }`}
                        >
                          {room.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => handleEditRoom(room)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteRoom(room._id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Department Tab */}
        {activeTab === "department" && (
          <div className="tab-content">
            <div className="content-header">
              <h2>Department Management</h2>
              <button
                className="btn-add"
                onClick={() => {
                  resetDepartmentForm();
                  setShowDepartmentModal(true);
                }}
              >
                ➕ Add Department
              </button>
            </div>

            <div className="filter-section">
              <select
                value={roomFilter}
                onChange={(e) => setRoomFilter(e.target.value)}
              >
                <option value="">All Rooms</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : departments.length === 0 ? (
              <div className="empty-state">
                <div>🏢</div>
                <h3>No Departments Found</h3>
                <p>Add departments to your organization</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Room</th>
                    <th>Floor</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department) => (
                    <tr key={department._id}>
                      <td>
                        <strong>{department.code}</strong>
                      </td>
                      <td>{department.name}</td>
                      <td>{department.room?.name || "-"}</td>
                      <td>{department.floor?.name || "-"}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            department.isActive ? "active" : "inactive"
                          }`}
                        >
                          {department.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => handleEditDepartment(department)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() =>
                              handleDeleteDepartment(department._id)
                            }
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Employee Tab */}
        {activeTab === "employee" && (
          <div className="tab-content">
            <div className="content-header">
              <h2>Employee Management</h2>
              <button
                className="btn-add"
                onClick={() => {
                  resetEmployeeForm();
                  setShowEmployeeModal(true);
                }}
              >
                ➕ Add Employee
              </button>
            </div>

            <div className="filter-section">
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {loading ? (
              <div className="loading">Loading...</div>
            ) : employees.length === 0 ? (
              <div className="empty-state">
                <div>👨‍💼</div>
                <h3>No Employees Found</h3>
                <p>Add employees to your organization</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Name</th>
                    <th>Department</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee._id}>
                      <td>
                        <strong>{employee.employeeId}</strong>
                      </td>
                      <td>{employee.name}</td>
                      <td>{employee.department?.name || "-"}</td>
                      <td>{employee.email}</td>
                      <td>{employee.phone || "-"}</td>
                      <td>{employee.position}</td>
                      <td>
                        <span
                          className={`status-badge ${
                            employee.isActive ? "active" : "inactive"
                          }`}
                        >
                          {employee.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            className="btn-icon btn-edit"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn-icon btn-delete"
                            onClick={() => handleDeleteEmployee(employee._id)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Campus Modal */}
        {showCampusModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowCampusModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedCampus ? "Edit Campus" : "Add New Campus"}</h2>
                <button
                  className="close-btn"
                  onClick={() => setShowCampusModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleCampusSubmit} className="modal-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Campus Name *</label>
                    <input
                      required
                      value={campusForm.name}
                      onChange={(e) =>
                        setCampusForm({ ...campusForm, name: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Code</label>
                    <input
                      value={campusForm.code}
                      onChange={(e) =>
                        setCampusForm({ ...campusForm, code: e.target.value })
                      }
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>City *</label>
                    <input
                      required
                      value={campusForm.city}
                      onChange={(e) =>
                        setCampusForm({ ...campusForm, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Country *</label>
                    <input
                      required
                      value={campusForm.country}
                      onChange={(e) =>
                        setCampusForm({
                          ...campusForm,
                          country: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input
                    value={campusForm.address}
                    onChange={(e) =>
                      setCampusForm({ ...campusForm, address: e.target.value })
                    }
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={campusForm.description}
                    onChange={(e) =>
                      setCampusForm({
                        ...campusForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowCampusModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading
                      ? "Saving..."
                      : selectedCampus
                      ? "Update"
                      : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Building Modal */}
        {showBuildingModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowBuildingModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  {selectedBuilding ? "Edit Building" : "Add New Building"}
                </h2>
                <button
                  className="close-btn"
                  onClick={() => setShowBuildingModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleBuildingSubmit} className="modal-form">
                <div className="form-group">
                  <label>Campus *</label>
                  <select
                    required
                    value={buildingForm.campus}
                    onChange={(e) =>
                      setBuildingForm({
                        ...buildingForm,
                        campus: e.target.value,
                      })
                    }
                  >
                    <option value="">Select Campus</option>
                    {campuses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Building Name *</label>
                    <input
                      required
                      value={buildingForm.name}
                      onChange={(e) =>
                        setBuildingForm({
                          ...buildingForm,
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Code</label>
                    <input
                      value={buildingForm.code}
                      onChange={(e) =>
                        setBuildingForm({
                          ...buildingForm,
                          code: e.target.value,
                        })
                      }
                      placeholder="Auto-generated if empty"
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={buildingForm.description}
                    onChange={(e) =>
                      setBuildingForm({
                        ...buildingForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowBuildingModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading
                      ? "Saving..."
                      : selectedBuilding
                      ? "Update"
                      : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Floor Modal */}
        {showFloorModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowFloorModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedFloor ? "Edit Floor" : "Add New Floor"}</h2>
                <button
                  className="close-btn"
                  onClick={() => setShowFloorModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleFloorSubmit} className="modal-form">
                <div className="form-group">
                  <label>Building *</label>
                  <select
                    required
                    value={floorForm.building}
                    onChange={(e) =>
                      setFloorForm({ ...floorForm, building: e.target.value })
                    }
                  >
                    <option value="">Select Building</option>
                    {buildings.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Floor Number *</label>
                    <input
                      type="number"
                      required
                      value={floorForm.floorNumber}
                      onChange={(e) =>
                        setFloorForm({
                          ...floorForm,
                          floorNumber: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Floor Name *</label>
                    <input
                      required
                      value={floorForm.name}
                      onChange={(e) =>
                        setFloorForm({ ...floorForm, name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Code</label>
                  <input
                    value={floorForm.code}
                    onChange={(e) =>
                      setFloorForm({ ...floorForm, code: e.target.value })
                    }
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={floorForm.description}
                    onChange={(e) =>
                      setFloorForm({
                        ...floorForm,
                        description: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowFloorModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading
                      ? "Saving..."
                      : selectedFloor
                      ? "Update"
                      : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Room Modal */}
        {showRoomModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowRoomModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{selectedRoom ? "Edit Room" : "Add New Room"}</h2>
                <button
                  className="close-btn"
                  onClick={() => setShowRoomModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleRoomSubmit} className="modal-form">
                <div className="form-group">
                  <label>Floor *</label>
                  <select
                    required
                    value={roomForm.floor}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, floor: e.target.value })
                    }
                  >
                    <option value="">Select Floor</option>
                    {floors.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name} - Floor {f.floorNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Room Number *</label>
                    <input
                      required
                      value={roomForm.roomNumber}
                      onChange={(e) =>
                        setRoomForm({ ...roomForm, roomNumber: e.target.value })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Room Name *</label>
                    <input
                      required
                      value={roomForm.name}
                      onChange={(e) =>
                        setRoomForm({ ...roomForm, name: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Code</label>
                  <input
                    value={roomForm.code}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, code: e.target.value })
                    }
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div className="form-group">
                  <label>Room Type *</label>
                  <select
                    required
                    value={roomForm.roomType}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, roomType: e.target.value })
                    }
                  >
                    {roomTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={roomForm.description}
                    onChange={(e) =>
                      setRoomForm({ ...roomForm, description: e.target.value })
                    }
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowRoomModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : selectedRoom ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Department Modal */}
        {showDepartmentModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowDepartmentModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  {selectedDepartment
                    ? "Edit Department"
                    : "Add New Department"}
                </h2>
                <button
                  className="close-btn"
                  onClick={() => setShowDepartmentModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleDepartmentSubmit} className="modal-form">
                <div className="form-group">
                  <label>Floor</label>
                  <select
                    value={departmentForm.floor}
                    onChange={(e) =>
                      setDepartmentForm({
                        ...departmentForm,
                        floor: e.target.value,
                        room: "",
                      })
                    }
                  >
                    <option value="">Select Floor</option>
                    {floors.map((f) => (
                      <option key={f._id} value={f._id}>
                        {f.name} - Floor {f.floorNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Room</label>
                  <select
                    value={departmentForm.room}
                    onChange={(e) =>
                      setDepartmentForm({
                        ...departmentForm,
                        room: e.target.value,
                      })
                    }
                    disabled={!departmentForm.floor}
                  >
                    <option value="">Select Room</option>
                    {rooms
                      .filter(
                        (r) =>
                          !departmentForm.floor ||
                          r.floor?._id === departmentForm.floor
                      )
                      .map((r) => (
                        <option key={r._id} value={r._id}>
                          {r.name} - {r.roomNumber}
                        </option>
                      ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Department Name *</label>
                  <input
                    required
                    value={departmentForm.name}
                    onChange={(e) =>
                      setDepartmentForm({
                        ...departmentForm,
                        name: e.target.value,
                      })
                    }
                    placeholder="e.g., Human Resources"
                  />
                </div>
                {selectedDepartment && (
                  <div className="form-group">
                    <label>Team Lead (Optional)</label>
                    <select
                      value={departmentForm.teamLead}
                      onChange={(e) =>
                        setDepartmentForm({
                          ...departmentForm,
                          teamLead: e.target.value,
                        })
                      }
                    >
                      <option value="">Select Team Lead</option>
                      {employees
                        .filter((emp) => emp.department?._id === selectedDepartment._id)
                        .map((emp) => (
                          <option key={emp._id} value={emp._id}>
                            {emp.name} - {emp.employeeId}
                          </option>
                        ))}
                    </select>
                    <small>Only employees from this department are shown</small>
                  </div>
                )}
                {!selectedDepartment && (
                  <div className="form-group">
                    <label>Team Lead</label>
                    <p style={{ fontSize: "13px", color: "#666", margin: "8px 0" }}>
                      Team lead can be assigned after creating the department and adding employees to it.
                    </p>
                  </div>
                )}
                <div className="form-row">
                  <div className="form-group">
                    <label>Check-In Leverage (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={departmentForm.checkInMinutes}
                      onChange={(e) =>
                        setDepartmentForm({
                          ...departmentForm,
                          checkInMinutes: e.target.value,
                        })
                      }
                      placeholder="15"
                    />
                    <small>Grace period for late check-in</small>
                  </div>
                  <div className="form-group">
                    <label>Check-Out Leverage (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={departmentForm.checkOutMinutes}
                      onChange={(e) =>
                        setDepartmentForm({
                          ...departmentForm,
                          checkOutMinutes: e.target.value,
                        })
                      }
                      placeholder="15"
                    />
                    <small>Grace period for early check-out</small>
                  </div>
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={departmentForm.description}
                    onChange={(e) =>
                      setDepartmentForm({
                        ...departmentForm,
                        description: e.target.value,
                      })
                    }
                    placeholder="Department description"
                  />
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowDepartmentModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading
                      ? "Saving..."
                      : selectedDepartment
                      ? "Update"
                      : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Employee Modal */}
        {showEmployeeModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowEmployeeModal(false)}
          >
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>
                  {selectedEmployee ? "Edit Employee" : "Add New Employee"}
                </h2>
                <button
                  className="close-btn"
                  onClick={() => setShowEmployeeModal(false)}
                >
                  ×
                </button>
              </div>
              <form onSubmit={handleEmployeeSubmit} className="modal-form">
                <div className="form-group">
                  <label>Department *</label>
                  <select
                    required
                    value={employeeForm.department}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        department: e.target.value,
                      })
                    }
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Employee ID</label>
                  <input
                    value={employeeForm.employeeId}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        employeeId: e.target.value,
                      })
                    }
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div className="form-group">
                  <label>Biometric ID *</label>
                  <input
                    required
                    type="text"
                    value={employeeForm.biometricId}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        biometricId: e.target.value.trim(),
                      })
                    }
                    placeholder="ID from biometric device (e.g., 123)"
                  />
                  <small>Enter the enrollment number from ZKTeco device</small>
                </div>
                <div className="form-group">
                  <label>Name *</label>
                  <input
                    required
                    value={employeeForm.name}
                    onChange={(e) =>
                      setEmployeeForm({ ...employeeForm, name: e.target.value })
                    }
                    placeholder="Full name"
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={employeeForm.email}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        email: e.target.value,
                      })
                    }
                    placeholder="employee@example.com"
                  />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    value={employeeForm.phone}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        phone: e.target.value,
                      })
                    }
                    placeholder="Phone number"
                  />
                </div>
                <div className="form-group">
                  <label>CNIC</label>
                  <input
                    type="text"
                    value={employeeForm.cnic}
                    onChange={(e) => {
                      let value = e.target.value.replace(/[^\d]/g, ''); // Remove non-digits
                      
                      // Limit to 13 digits
                      if (value.length > 13) {
                        value = value.slice(0, 13);
                      }
                      
                      // Format: XXXXX-XXXXXXX-X
                      let formatted = '';
                      if (value.length > 0) {
                        formatted = value.slice(0, 5);
                      }
                      if (value.length > 5) {
                        formatted += '-' + value.slice(5, 12);
                      }
                      if (value.length > 12) {
                        formatted += '-' + value.slice(12, 13);
                      }
                      
                      setEmployeeForm({
                        ...employeeForm,
                        cnic: formatted,
                      });
                    }}
                    placeholder="XXXXX-XXXXXXX-X"
                    maxLength="15"
                  />
                  <small>Format: XXXXX-XXXXXXX-X</small>
                </div>
                <div className="form-group">
                  <label>Position *</label>
                  <input
                    required
                    value={employeeForm.position}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        position: e.target.value,
                      })
                    }
                    placeholder="e.g., Software Engineer"
                  />
                </div>
                <div className="form-group">
                  <label>Monthly Salary (PKR)</label>
                  <input
                    type="number"
                    min="0"
                    value={employeeForm.monthlySalary}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        monthlySalary: e.target.value,
                      })
                    }
                    placeholder="e.g., 50000"
                  />
                </div>
                <div className="form-group">
                  <label>Joining Date</label>
                  <input
                    type="date"
                    value={employeeForm.joiningDate}
                    onChange={(e) =>
                      setEmployeeForm({
                        ...employeeForm,
                        joiningDate: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Check-In Time *</label>
                    <input
                      required
                      type="time"
                      value={employeeForm.checkInTime}
                      onChange={(e) =>
                        setEmployeeForm({
                          ...employeeForm,
                          checkInTime: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>Check-Out Time *</label>
                    <input
                      required
                      type="time"
                      value={employeeForm.checkOutTime}
                      onChange={(e) =>
                        setEmployeeForm({
                          ...employeeForm,
                          checkOutTime: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Weekly Offs *</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "8px" }}>
                    {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
                      <label key={day} style={{ display: "flex", alignItems: "center", gap: "5px", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={employeeForm.weeklyOffs.includes(day)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEmployeeForm({
                                ...employeeForm,
                                weeklyOffs: [...employeeForm.weeklyOffs, day],
                              });
                            } else {
                              setEmployeeForm({
                                ...employeeForm,
                                weeklyOffs: employeeForm.weeklyOffs.filter((d) => d !== day),
                              });
                            }
                          }}
                        />
                        <span>{day}</span>
                      </label>
                    ))}
                  </div>
                  <small>Select weekly off days</small>
                </div>
                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowEmployeeModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading
                      ? "Saving..."
                      : selectedEmployee
                      ? "Update"
                      : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Organization;
