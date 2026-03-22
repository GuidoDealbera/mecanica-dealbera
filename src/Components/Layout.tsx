import { Outlet, useNavigate } from "react-router-dom";
import Header from "./Header";
import ErrorBoundary from "../Pages/Components/ErrorBoundary";

const Layout = () => {
  const navigate = useNavigate();
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <main className="p-4 flex-1 overflow-auto">
        <ErrorBoundary onBack={() => navigate(-1)}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
};

export default Layout;
