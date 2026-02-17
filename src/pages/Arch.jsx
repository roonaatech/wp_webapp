import React, { useState } from 'react';
import MermaidChart from '../components/MermaidChart';
import { FiDatabase, FiServer, FiLayers, FiCode, FiCpu, FiLayout, FiSmartphone, FiGlobe } from 'react-icons/fi';

const Arch = () => {
    const [activeTab, setActiveTab] = useState('architecture');

    const architectureChart = `
    graph TD
        subgraph Client_Side [Client Side]
            M["Mobile App (Flutter)"]
            W["Web App (React + Vite)"]
        end

        subgraph Server_Side [Server Side]
            LB["Load Balancer / API Gateway"]
            Node["Node.js + Express Server"]
            Auth["Auth Middleware"]
            
            subgraph Controllers
                AuthC["Auth Controller"]
                AdminC["Admin Controller"]
                LeaveC["Leave Controller"]
                ReportC["Report Controller"]
                Logic["Business Logic"]
            end
            
            DB[("MySQL Database")]
        end

        M -->|"HTTP Requests"| LB
        W -->|"HTTP Requests"| LB
        LB --> Node
        Node --> Auth
        
        Auth --> AuthC
        Auth --> AdminC
        Auth --> LeaveC
        Auth --> ReportC
        
        AuthC --> Logic
        AdminC --> Logic
        LeaveC --> Logic
        ReportC --> Logic
        
        Logic --> DB
    `;

    const erDiagram = `
    erDiagram
        Users {
            int staffid PK "Auto Increment"
            string(50) firstname "NOT NULL"
            string(50) lastname "NOT NULL"
            string(100) email "Unique, NOT NULL"
            string(250) password "Hashed"
            int role FK "Ref: Roles.id"
            int approving_manager_id FK "Ref: Users.staffid"
            enum gender "Male, Female, Transgender"
            tinyint active "Default: 1"
        }
        Roles {
            int id PK
            string name "Internal System Name"
            string display_name "UI Display Name"
            int hierarchy_level "0=High Authority"
            enum can_approve_leave "all, subordinates, none"
        }
        LeaveRequests {
            int id PK
            int staff_id FK
            date start_date
            date end_date
            string reason
            enum status "Pending, Approved, Rejected"
            int manager_id FK "Approver"
            int leave_type_id FK
        }
        OnDutyLogs {
            int id PK
            int staff_id FK
            date date
            string client_name
            string location
            string coordinates "Lat,Lng"
            string remarks
        }
        Approvals {
            int id PK
            int manager_id FK "Who approved/rejected"
            int attendance_log_id FK "Nullable"
            int on_duty_log_id FK "Nullable"
            enum status "Approved, Rejected"
            datetime created_at
        }
        ActivityLogs {
            int id PK
            int admin_id FK "Who performed action"
            int affected_user_id FK "Target user"
            string action "CREATE, UPDATE, DELETE"
            string description
            string ip_address
        }
        ApkVersions {
            int id PK
            string version "SemVer (e.g. 1.0.0)"
            string file_path
            int uploaded_by FK
            text release_notes
        }
        LeaveTypes {
            int id PK
            string name "Sick, Casual, etc."
            int days_allowed "Annual Quota"
            boolean status "Active/Inactive"
        }
        UserLeaveTypes {
            int id PK
            int user_id FK
            int leave_type_id FK
            decimal days_used "Count of taken leaves"
        }
        TimeOffRequests {
            int id PK
            int staff_id FK
            datetime start_time
            datetime end_time
            string reason
            enum status
        }

        %% Relationships
        Users ||--o{ LeaveRequests : "requests"
        Users ||--o{ OnDutyLogs : "logs_visit"
        Users ||--o{ Approvals : "approves"
        Users ||--o{ ActivityLogs : "triggers"
        Users ||--o{ ApkVersions : "uploads"
        Users ||--o{ UserLeaveTypes : "has_balance"
        Users ||--o{ TimeOffRequests : "requests_short_leave"
        Users }|--|| Roles : "assigned_role"
        Users |o--o| Users : "reports_to"
        
        LeaveRequests }|--|| Users : "requested_by"
        LeaveRequests }|--|| LeaveTypes : "type_of"
        
        OnDutyLogs }|--|| Users : "performed_by"
        
        Approvals }|--|| Users : "decided_by"
        Approvals |o--|| OnDutyLogs : "validates"
        
        UserLeaveTypes }|--|| LeaveTypes : "category"
    `;

    const schemaDetails = [
        {
            table: "Users",
            desc: "Core entity storing employee credentials, profile data, and organizational hierarchy links.",
            keys: [
                { col: "staffid", type: "PK", note: "Primary Identifier" },
                { col: "role", type: "FK", note: "Links to Roles table" },
                { col: "approving_manager_id", type: "FK", note: "Self-referencing FK for reporting manager" }
            ]
        },
        {
            table: "Roles",
            desc: "Defines access levels and permissions. Uses 'hierarchy_level' to enforce vertical security logic (e.g., higher level can edit lower level).",
            keys: [
                { col: "id", type: "PK", note: "Role ID" },
                { col: "hierarchy_level", type: "INT", note: "Lower value = Higher Authority (0 is Super Admin)" }
            ]
        },
        {
            table: "LeaveRequests",
            desc: "Stores long-term leave applications (Full Day). Linked to specific Leave Types (Sick, Casual).",
            keys: [
                { col: "staff_id", type: "FK", note: "Applicant" },
                { col: "manager_id", type: "FK", note: "Assigned Approver" }
            ]
        },
        {
            table: "OnDutyLogs",
            desc: "Records off-site client visits or field work. Includes geolocation data for validation.",
            keys: [
                { col: "coordinates", type: "STRING", note: "stored as 'lat,lng'" }
            ]
        },
        {
            table: "Approvals",
            desc: "Audit trail for management decisions. One-to-One link with either Leave or OnDuty requests.",
            keys: [
                { col: "manager_id", type: "FK", note: "The decision maker" }
            ]
        },
        {
            table: "UserLeaveTypes",
            desc: "Pivot table tracking leave balances per user per leave type. Handles custom quotas and consumption tracking.",
            keys: [
                { col: "days_used", type: "DECIMAL", note: "Accumulated leaves taken" }
            ]
        }
    ];

    const controllers = {
        "Admin Controller": [
            {
                name: "getIncompleteProfiles",
                params: "None",
                purpose: "Retrieves a list of user profiles that are missing mandatory information (e.g., gender, role)."
            },
            {
                name: "createUser",
                params: "req.body { firstname, lastname, email, password, role, gender, approving_manager_id }",
                purpose: "Creates a new user account, validating unique email and role hierarchy permissions."
            },
            {
                name: "updateUser",
                params: "req.params { id }, req.body { firstname, lastname, email, role, gender, active, ... }",
                purpose: "Updates an existing user's details. Enforces hierarchy checks to prevent unauthorized escalations."
            },
            {
                name: "resetUserPassword",
                params: "req.params { id }, req.body { newPassword }",
                purpose: "Allows an admin to forcibly reset a user's password. Requires management permissions."
            },
            {
                name: "getAllUsers",
                params: "req.query { page, limit, search, status, role, userType }",
                purpose: "Retrieves a paginated list of users with extensive filtering options for the user management table."
            },
            {
                name: "getManagersAndAdmins",
                params: "None",
                purpose: "Fetches a list of all users who have approval privileges (managers/admins) for dropdown selection."
            },
            {
                name: "getPendingApprovals",
                params: "req.userId (from token)",
                purpose: "Aggregates all pending leave and on-duty requests that require the current user's approval."
            },
            {
                name: "approveAttendance",
                params: "req.params { id }, req.body { status, rejection_reason }",
                purpose: "Processes an approval decision (Approve/Reject) for a specific attendance/leave request."
            },
            {
                name: "getAttendanceReports",
                params: "req.query { startDate, endDate, userId, departmentId }",
                purpose: "Generates comprehensive attendance reports based on date ranges and user filters."
            },
            {
                name: "getDashboardStats",
                params: "None",
                purpose: "Calculates and returns aggregate statistics (present count, leave count, pending requests) for the dashboard."
            }
        ],
        "Auth Controller": [
            {
                name: "signup",
                params: "req.body { firstname, lastname, email, password }",
                purpose: "Registers a new user into the system. Often restricted to admin-only in enterprise setups."
            },
            {
                name: "signin",
                params: "req.body { email, password }",
                purpose: "Authenticates a user, verifies credentials, and issues a JWT access token."
            },
            {
                name: "logout",
                params: "req.userId",
                purpose: "Invalidates the user's current session (if server-side session tracking is used) or clears client cookies."
            },
            {
                name: "changePassword",
                params: "req.body { oldPassword, newPassword }",
                purpose: "Allows an authenticated user to change their own password by verifying the old one first."
            }
        ],
        "Leave Controller": [
            {
                name: "applyLeave",
                params: "req.body { leave_type_id, start_date, end_date, reason }",
                purpose: "Submits a formal leave request for a specified date range. Triggers email notifications to managers."
            },
            {
                name: "getMyLeaves",
                params: "req.query { page, limit, status, year }",
                purpose: "Retrieves the history of leave requests submitted by the currently logged-in user."
            },
            {
                name: "getPendingLeaves",
                params: "req.userId",
                purpose: "Fetches leave requests specifically waiting for the current user's review/approval."
            },
            {
                name: "updateLeaveStatus",
                params: "req.params { id }, req.body { status, rejection_reason }",
                purpose: "Updates the status of a leave request (Approved/Rejected) and logs the action."
            },
            {
                name: "getUserLeaveBalance",
                params: "req.params { id }",
                purpose: "Calculates the remaining leave balance for a specific user based on total allowed vs. used days."
            }
        ],
        "OnDuty Controller": [
            {
                name: "startOnDuty",
                params: "req.body { client_name, location, remarks, coordinates }",
                purpose: "Logs the beginning of an off-site work assignment (On-Duty). Captures geolocation."
            },
            {
                name: "endOnDuty",
                params: "req.params { id }, req.body { closing_remarks }",
                purpose: "Marks the completion of an active on-duty session."
            },
            {
                name: "getActiveOnDuty",
                params: "req.userId",
                purpose: "Checks if the user has any currently ongoing on-duty sessions."
            },
            {
                name: "updateOnDutyStatus",
                params: "req.params { id }, req.body { status }",
                purpose: "Managerial action to approve or reject a retrospective or planned on-duty request."
            }
        ],
        "Activity Controller": [
            {
                name: "getAllActivities",
                params: "req.query { page, limit, text }",
                purpose: "Retrieves system-wide audit logs for admins to track user actions and system events."
            },
            {
                name: "getUserActivityHistory",
                params: "req.params { userId }",
                purpose: "Fetches a timeline of actions performed by a specific user for security auditing."
            }
        ],
        "Apk Controller": [
            {
                name: "uploadApk",
                params: "req.file (multipart/form-data), req.body { version, notes }",
                purpose: "Hanldes the upload of a new Android APK file, parses version info, and stores it."
            },
            {
                name: "getLatestApk",
                params: "None",
                purpose: "Returns metadata for the most recent APK version to trigger in-app updates."
            },
            {
                name: "downloadApk",
                params: "req.params { filename }",
                purpose: "Serves the actual APK file binary to the client for installation."
            },
            {
                name: "checkVersion",
                params: "req.query { version }",
                purpose: "Compares the client's current version against the server's latest to determine if an update is required."
            }
        ],
        "Email Controller": [
            {
                name: "getConfig",
                params: "None",
                purpose: "Retrieves the current SMTP email server configuration (host, port, auth)."
            },
            {
                name: "updateConfig",
                params: "req.body { host, port, user, pass, secure }",
                purpose: "Updates the system's email delivery settings."
            },
            {
                name: "sendTestEmail",
                params: "req.body { toEmail }",
                purpose: "Sends a dummy email to verify that the SMTP configuration is working correctly."
            }
        ],
        "Role Controller": [
            {
                name: "findAll",
                params: "None",
                purpose: "Lists all defined user roles (e.g., Admin, Manager, Employee) and their permissions."
            },
            {
                name: "create",
                params: "req.body { name, permissions_object }",
                purpose: "Defines a new role with a specific set of access permissions."
            },
            {
                name: "update",
                params: "req.params { id }, req.body { name, permissions_object }",
                purpose: "Modifies the permissions associated with an existing role."
            },
            {
                name: "updateHierarchy",
                params: "req.body { hierarchy_list }",
                purpose: "Reorders roles to establish a reporting hierarchy (e.g., who reports to whom)."
            }
        ],
        "Setting Controller": [
            {
                name: "getSettings",
                params: "None",
                purpose: "Retrieves global system settings (e.g., timezone, allowed ip ranges)."
            },
            {
                name: "updateSetting",
                params: "req.body { key, value }",
                purpose: "Updates a specific system configuration key-value pair."
            },
            {
                name: "getPublicSettings",
                params: "None",
                purpose: "Fetches non-sensitive settings required for the login page or public areas."
            }
        ],
        "TimeOff Controller": [
            {
                name: "applyTimeOff",
                params: "req.body { date, start_time, end_time, reason }",
                purpose: "Requests a short leave (Time Off) typically measured in hours rather than days."
            },
            {
                name: "updateTimeOffDetails",
                params: "req.params { id }, req.body { ... }",
                purpose: "Allows modification of a pending time-off request's details."
            },
            {
                name: "updateTimeOffStatus",
                params: "req.params { id }, req.body { status }",
                purpose: "Approves or rejects a time-off request."
            },
            {
                name: "deleteTimeOff",
                params: "req.params { id }",
                purpose: "Withdraws or deletes a time-off request from the system."
            },
            {
                name: "getMyTimeOffRequests",
                params: "req.query { page, year }",
                purpose: "Lists the current user's history of time-off applications."
            }
        ],
        "Attendance Controller": [
            {
                name: "checkIn",
                params: "req.body { latitude, longitude, address }",
                purpose: "Records the user's start time. Validates location against geofencing rules if enabled."
            },
            {
                name: "checkOut",
                params: "req.body { latitude, longitude }",
                purpose: "Records the user's end time and calculates total working hours for the day."
            }
        ],
        "History Controller": [
            {
                name: "getAttendanceHistory",
                params: "req.query { month, year }",
                purpose: "Retrieves a detailed daily log of attendance (in/out times) for a selected month."
            }
        ],
        "UserLeaveType Controller": [
            {
                name: "getUserLeaveTypes",
                params: "req.params { userId }",
                purpose: "Fetches the specific leave quotas (e.g., Casual: 10, Sick: 5) assigned to a user."
            },
            {
                name: "updateUserLeaveTypes",
                params: "req.body { user_id, leave_types_array }",
                purpose: "Manually overrides or adjusts the leave balance for a user (e.g., adding comp-off days)."
            }
        ],
        "Dashboard Controller": [
            {
                name: "getDashboardStats",
                params: "None",
                purpose: "Provides a high-level summary of the day's attendance and pending actions for the user's home screen."
            }
        ]
    };

    const securityDiagram = `
    sequenceDiagram
        participant User as User (Web/Mobile)
        participant FE as Frontend App
        participant API as API Gateway/LB
        participant Auth as Auth Middleware
        participant Ctrl as Controller
        participant DB as Database

        Note over User, FE: Login Flow
        User->>FE: Enters Credentials
        FE->>API: POST /api/auth/signin
        API->>Ctrl: Validate User
        Ctrl->>DB: Check Email & Hash(Password)
        DB-->>Ctrl: User Found
        Ctrl-->>API: Returns JWT Token
        API-->>FE: Stores Token (LocalStorage/SecureStore)

        Note over User, FE: Secure Request Flow
        User->>FE: Clicks "Approve Leave"
        FE->>API: POST /api/admin/approve (w/ Bearer Token)
        API->>Auth: Verify Token Signature
        Auth-->>API: Token Valid (Decoded UserID)
        API->>Auth: Check Role Permissions
        Auth-->>API: Access Granted
        API->>Ctrl: Execute Action
        Ctrl->>DB: Update Record
        DB-->>Ctrl: Success
        Ctrl-->>FE: 200 OK
    `;

    return (
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden min-h-screen" >
            {/* Header */}
            < div className="bg-slate-900 text-white p-8" >
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <FiServer className="text-blue-400" />
                    System Architecture & Documentation
                </h1>
                <p className="mt-2 text-slate-400">Technical overview, design patterns, and API reference.</p>
            </div >

            {/* Navigation Tabs */}
            < div className="flex border-b border-gray-200 bg-gray-50 flex-wrap" >
                {
                    [
                        { id: 'architecture', label: 'Architecture', icon: FiLayers },
                        { id: 'security', label: 'Security Flow', icon: FiCpu },
                        { id: 'design', label: 'Design System', icon: FiLayout },
                        { id: 'dev-docs', label: 'Developer Docs', icon: FiCode },
                        { id: 'database', label: 'Database Schema', icon: FiDatabase }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${activeTab === tab.id
                                ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm'
                                : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <tab.icon />
                            {tab.label}
                        </button>
                    ))
                }
            </div >

            {/* Content Area */}
            < div className="p-8 bg-gray-50 min-h-[600px]" >

                {/* Architecture Tab */}
                {
                    activeTab === 'architecture' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <FiGlobe /> System Overview
                                </h2>
                                <p className="text-gray-600 mb-6 leading-relaxed">
                                    WorkPulse is a robust attendance and leave management system built on a microservices-inspired monolithic architecture.
                                    It features a cross-platform strategy with a Flutter-based mobile app for field employees and a React-based web dashboard
                                    for administration and management.
                                </p>
                                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                    <MermaidChart chart={architectureChart} uniqueId="arch-diagram" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                                        <FiSmartphone className="text-green-500" /> Mobile App
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-2">
                                        <li>• <strong>Framework:</strong> Flutter (Dart)</li>
                                        <li>• <strong>Key Features:</strong> Geo-fencing, Attendance Marking, Push Notifications</li>
                                        <li>• <strong>State Mgmt:</strong> Provider</li>
                                    </ul>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                                        <FiGlobe className="text-blue-500" /> Web Dashboard
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-2">
                                        <li>• <strong>Framework:</strong> React + Vite</li>
                                        <li>• <strong>Styling:</strong> Tailwind CSS</li>
                                        <li>• <strong>Charts:</strong> Recharts & Chart.js</li>
                                    </ul>
                                </div>
                                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                                        <FiServer className="text-purple-500" /> Backend
                                    </h3>
                                    <ul className="text-sm text-gray-600 space-y-2">
                                        <li>• <strong>Runtime:</strong> Node.js (Express)</li>
                                        <li>• <strong>Database:</strong> MySQL (Sequelize ORM)</li>
                                        <li>• <strong>Auth:</strong> JWT & Role-Based Access</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Security Tab (New) */}
                {activeTab === 'security' && (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FiCpu /> End-to-End Security Flow
                            </h2>
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                The system utilizes <strong>JSON Web Tokens (JWT)</strong> for stateless authentication, ensuring secure communication between client applications (Mobile/Web) and the backend API.
                                Passwords are hashed using <strong>bcrypt</strong> before storage. Role-based access control (RBAC) middleware enforces permissions at the API route level.
                            </p>
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                                <MermaidChart chart={securityDiagram} uniqueId="sec-details" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                                    Authentication & Authorization
                                </h3>
                                <ul className="space-y-3 text-sm text-gray-600">
                                    <li className="flex gap-2">
                                        <span className="font-semibold text-blue-600 min-w-[100px]">JWT:</span>
                                        <span>Stateless tokens expiring every 24h. Contains `sub` (userId) and `role` claims to minimize DB lookups.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="font-semibold text-blue-600 min-w-[100px]">Middleware:</span>
                                        <span>`authJwt.verifyToken` checks signature. `isAdmin` / `isModerator` checks user privileges.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="font-semibold text-blue-600 min-w-[100px]">RBAC:</span>
                                        <span>Granular permissions (e.g., `can_manage_users`, `can_approve_leave`) defined in Roles table.</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="font-bold text-lg text-gray-800 mb-2 flex items-center gap-2">
                                    Data & Network Security
                                </h3>
                                <ul className="space-y-3 text-sm text-gray-600">
                                    <li className="flex gap-2">
                                        <span className="font-semibold text-green-600 min-w-[100px]">Encryption:</span>
                                        <span>Passwords hashed via `bcryptjs` (salt rounds: 10). SSL/TLS required for all traffic in production.</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="font-semibold text-green-600 min-w-[100px]">API Security:</span>
                                        <span>Rate limiting on auth endpoints. CORS policies restricting origin access. SQL injection protection via Sequelize ORM parameterization.</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}
                {/* Design Tab */}
                {
                    activeTab === 'design' && (
                        <div className="space-y-8 animate-fadeIn">
                            {/* Intro Section */}
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">Frontend Design System</h2>
                                <p className="text-gray-600 leading-relaxed mb-6">
                                    The WorkPulse web application is built on a modern <strong>React + Vite</strong> stack, utilizing
                                    <strong>Tailwind CSS</strong> for utility-first styling. The architecture emphasizes modularity,
                                    component reusability, and a clear separation of concerns between presentation and business logic.
                                </p>

                                <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 mb-8">
                                    <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                                        <FiLayout /> Application Structure
                                    </h3>
                                    <MermaidChart chart={`
                                graph TD
                                    App[App Root] --> Router[React Router]
                                    Router --> Public[Public Routes]
                                    Router --> Protected[Protected Routes]
                                    
                                    Public --> Login
                                    Protected --> Layout[Main Layout]
                                    
                                    Layout --> Sidebar[Sidebar Nav]
                                    Layout --> Header[Top Header]
                                    Layout --> Content[Page Content]
                                    
                                    Content --> Dash[Dashboard]
                                    Content --> Users[User Mgmt]
                                    Content --> Leaves[Leave Mgmt]
                                    
                                    Sidebar -.-> Navigation
                                    Header -.-> UserMenu
                                `} uniqueId="fe-structure" />
                                </div>
                            </div>

                            {/* Design Tokens Section */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                        Color Identity
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-lg bg-slate-900 shadow-md"></div>
                                            <div>
                                                <p className="font-semibold text-gray-800">Neutral / Surface</p>
                                                <p className="text-xs text-slate-500 font-mono">Slate-900 (#0f172a)</p>
                                                <p className="text-sm text-gray-500">Used for sidebars and primary headings.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-lg bg-blue-600 shadow-md"></div>
                                            <div>
                                                <p className="font-semibold text-gray-800">Primary Brand</p>
                                                <p className="text-xs text-slate-500 font-mono">Blue-600 (#2563eb)</p>
                                                <p className="text-sm text-gray-500">Primary actions, links, and active states.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-lg bg-emerald-500 shadow-md"></div>
                                            <div>
                                                <p className="font-semibold text-gray-800">Success State</p>
                                                <p className="text-xs text-slate-500 font-mono">Emerald-500 (#10b981)</p>
                                                <p className="text-sm text-gray-500">Approvals, success toasts, and positive indicators.</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-lg bg-rose-500 shadow-md"></div>
                                            <div>
                                                <p className="font-semibold text-gray-800">Error / Danger</p>
                                                <p className="text-xs text-slate-500 font-mono">Rose-500 (#f43f5e)</p>
                                                <p className="text-sm text-gray-500">Deletions, errors, and rejection actions.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                        Core UI Components
                                    </h3>
                                    <ul className="space-y-4">
                                        <li className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="font-semibold text-gray-800 mb-1">Sidebar Navigation</div>
                                            <p className="text-sm text-gray-600">
                                                Responsive, collapsible navigation bar managing routing state.
                                                Handles active path highlighting and role-based menu visibility.
                                            </p>
                                        </li>
                                        <li className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="font-semibold text-gray-800 mb-1">Protected Route Wrapper</div>
                                            <p className="text-sm text-gray-600">
                                                High-Order Component (HOC) that validates authentication tokens
                                                before rendering child routes. Redirects unauthenticated users to login.
                                            </p>
                                        </li>
                                        <li className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                                            <div className="font-semibold text-gray-800 mb-1">Dynamic Tables</div>
                                            <p className="text-sm text-gray-600">
                                                Data-driven tables with support for pagination, sorting, and row actions.
                                                Used extensively in Users, Reports, and Logs pages.
                                            </p>
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            {/* Integration Patterns */}
                            <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                                <h3 className="text-xl font-bold text-gray-800 mb-6">Integration Patterns</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
                                        <div className="text-blue-500 mb-2"><FiGlobe className="text-2xl" /></div>
                                        <h4 className="font-bold text-gray-800 mb-2">API Layer (Axios)</h4>
                                        <p className="text-sm text-gray-600">
                                            Centralized Axios instance with <strong>interceptors</strong>. Automatically attaches
                                            JWT tokens to every outgoing request and handles global error responses (e.g., 401 Unauthorized logout).
                                        </p>
                                    </div>
                                    <div className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
                                        <div className="text-purple-500 mb-2"><FiCode className="text-2xl" /></div>
                                        <h4 className="font-bold text-gray-800 mb-2">State Management</h4>
                                        <p className="text-sm text-gray-600">
                                            Combination of <strong>Local State</strong> (useState) for UI components and
                                            <strong>Global Props/Context</strong> for user session data. Data fetching is triggered
                                            via `useEffect` hooks on component mount.
                                        </p>
                                    </div>
                                    <div className="p-4 border border-gray-200 rounded-lg hover:border-green-300 transition-colors">
                                        <div className="text-green-500 mb-2"><FiLayout className="text-2xl" /></div>
                                        <h4 className="font-bold text-gray-800 mb-2">User Feedback</h4>
                                        <p className="text-sm text-gray-600">
                                            Utilizes <strong>react-hot-toast</strong> for non-blocking notifications.
                                            Provides immediate visual feedback for async actions (success/failure) without
                                            interrupting user workflow.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Developer Docs Tab */}
                {
                    activeTab === 'dev-docs' && (
                        <div className="space-y-6 animate-fadeIn">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">Backend Controller Reference</h2>
                                <p className="text-gray-600 mb-6">
                                    Detailed specification of all backend controllers, including their method signatures,
                                    expected parameters, and functional purpose.
                                </p>

                                <div className="grid grid-cols-1 gap-6">
                                    {Object.entries(controllers).map(([controllerName, methods]) => (
                                        <div key={controllerName} className="border border-gray-200 rounded-lg overflow-hidden">
                                            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 font-semibold text-gray-700 flex items-center gap-2">
                                                <FiCode className="text-blue-500" />
                                                {controllerName}
                                            </div>
                                            <div className="divide-y divide-gray-100">
                                                {methods.map((method, idx) => (
                                                    <div key={idx} className="px-6 py-4 hover:bg-blue-50 transition-colors">
                                                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2 mb-2">
                                                            <span className="font-mono text-sm font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded inline-block w-fit">
                                                                {method.name}()
                                                            </span>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-2 text-sm">
                                                            <div className="text-gray-500 font-medium">Parameters:</div>
                                                            <div className="font-mono text-xs text-blue-700 bg-blue-50 p-1.5 rounded border border-blue-100 break-words">
                                                                {method.params}
                                                            </div>

                                                            <div className="text-gray-500 font-medium mt-1">Purpose:</div>
                                                            <div className="text-gray-700 mt-1">
                                                                {method.purpose}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }

                {/* Database Tab */}
                {
                    activeTab === 'database' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <FiDatabase /> Entity Relationship Diagram (ERD)
                                </h2>
                                <p className="text-gray-600 mb-6">
                                    Visual representation of the database schema and relationships between different entities.
                                </p>
                                <div className="overflow-x-auto bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="min-w-[800px]">
                                        <MermaidChart chart={erDiagram} uniqueId="er-diagram" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <h2 className="text-xl font-bold text-gray-800 mb-4">Table Reference</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {schemaDetails.map((schema, idx) => (
                                        <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                            <h3 className="font-bold text-lg text-blue-900 mb-2">{schema.table}</h3>
                                            <p className="text-sm text-gray-600 mb-4">{schema.desc}</p>

                                            <div className="space-y-2">
                                                {schema.keys.map((k, kIdx) => (
                                                    <div key={kIdx} className="flex items-center text-sm gap-2">
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${k.type === 'PK' ? 'bg-yellow-100 text-yellow-800' :
                                                            k.type === 'FK' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'
                                                            }`}>
                                                            {k.type}
                                                        </span>
                                                        <span className="font-mono text-gray-700">{k.col}</span>
                                                        <span className="text-gray-400 text-xs italic">- {k.note}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >
        </div >
    );
};

export default Arch;
