# WorkPulse Web Admin

A modern, responsive web application for managing WorkPulse, built with React and Vite. This admin dashboard provides tools for user management, attendance tracking, leave approvals, and comprehensive reporting.

## 🚀 Tech Stack

- **Frontend Framework**: [React 18](https://reactjs.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **State/Routing**: [React Router DOM v6](https://reactrouter.com/)
- **Charts/Visualization**: [Chart.js](https://www.chartjs.org/), [Recharts](https://recharts.org/)
- **Icons**: [React Icons](https://react-icons.github.io/react-icons/)
- **HTTP Client**: [Axios](https://axios-http.com/)

## ✨ Key Features

- **Dashboard**: Real-time stats and visual overview of employee attendance.
- **User Management**: View and manage system users.
- **Approvals**: Streamlined workflows for approving Leave and On-Duty requests.
- **Attendance Reports**: Generate detailed reports on attendance patterns.
- **Activity Log**: Track system-wide activities.
- **Leave Configuration**: Manage and define various leave types.
- **Calendar View**: Visual representation of schedules and holidays.
- **On-Duty Tracking**: Monitor active on-duty personnel.

## 📁 Project Structure

```text
src/
├── components/     # Reusable UI components (Sidebar, Header, etc.)
├── config/         # Centralized configuration (API endpoints)
├── pages/          # Full-page components (Dashboard, Users, Login)
├── utils/          # Helper functions and utilities
├── App.jsx         # Main application routing and layout
└── main.jsx        # Entry point
```

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.0.0 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd wp_webapp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

### Production Build

Create an optimized build for production:
```bash
npm run build
```
The output will be in the `dist` folder.

## ⚙️ Configuration

### API Backend URL

All backend API URLs are centralized in `src/config/api.config.js`. The application automatically switches between development and production URLs based on the environment.

For detailed instructions on changing the backend URL, refer to the [API Configuration Guide](./API_CONFIG_GUIDE.md).


