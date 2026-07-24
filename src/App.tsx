import AdminOperationPage from "./pages/AdminOperationPage";
import AdminReportsPage from "./pages/AdminReportsPage";
import OperatorPage from "./pages/OperatorPage";

export default function App() {
  const path = window.location.pathname;

  if (path.startsWith("/admin/reports")) {
    return <AdminReportsPage />;
  }

  if (path.startsWith("/admin")) {
    return <AdminOperationPage />;
  }

  return <OperatorPage />;
}
