import React from "react";
import { Button, Navbar, NavbarContent, NavbarItem, Tooltip, User } from "@heroui/react";
import { IoMdArrowBack } from "react-icons/io";
import { IoSearch } from "react-icons/io5";
import { MdWarning, MdBackup } from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import avatarImg from "../assets/images/avatar.png";
import GlobalSearch from "./SearchBars/GlobalSearch";

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const isHome = location.pathname === "/";

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const BUTTONS = [
    { path: "/", text: "Inicio" },
    { path: "/clients", text: "Clientes" },
    { path: "/cars", text: "Autos" },
  ];

  const ICON_BUTTONS = [
    { path: "/alerts", icon: <MdWarning size={18} />, tooltip: "Alertas de service", color: "warning" as const },
    { path: "/backup", icon: <MdBackup size={18} />, tooltip: "Gestión de datos", color: "default" as const },
  ];

  return (
    <>
      <Navbar className="bg-foreground-800 shadow shadow-primary-700" maxWidth="full">
        <NavbarContent>
          {!isHome && (
            <Tooltip content="Atrás" placement="bottom-end" className="bg-primary-700 text-white">
              <Button
                isIconOnly
                onPress={() => navigate(-1)}
                radius="full"
                className="bg-primary-700 text-white text-lg"
              >
                <IoMdArrowBack />
              </Button>
            </Tooltip>
          )}
          {BUTTONS.map(({ path, text }) => {
            const isActive =
              path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            return (
              <NavbarItem key={path} isActive={isActive}>
                <Button
                  onPress={() => (!isActive ? navigate(path) : null)}
                  className={`font-bold text-white text-shadow-2xs shadow ${
                    isActive
                      ? "bg-primary-500 shadow-primary-500"
                      : "bg-primary-700 shadow-primary-700"
                  }`}
                >
                  {text}
                </Button>
              </NavbarItem>
            );
          })}
        </NavbarContent>

        <NavbarContent justify="end" className="gap-2">
          {ICON_BUTTONS.map(({ path, icon, tooltip, color }) => {
            const isActive = location.pathname === path;
            return (
              <Tooltip key={path} content={tooltip} placement="bottom" className="bg-primary-700 text-white">
                <Button
                  isIconOnly
                  radius="full"
                  color={isActive ? color : "default"}
                  variant={isActive ? "solid" : "flat"}
                  className={isActive ? "" : "bg-foreground-700 text-foreground-300"}
                  onPress={() => navigate(path)}
                >
                  {icon}
                </Button>
              </Tooltip>
            );
          })}

          <Tooltip content="Buscar (Ctrl+K)" placement="bottom" className="bg-primary-700 text-white">
            <Button
              isIconOnly
              radius="full"
              className="bg-primary-700 text-white"
              onPress={() => setSearchOpen(true)}
            >
              <IoSearch size={18} />
            </Button>
          </Tooltip>

          <User
            name="Horacio Dealbera"
            avatarProps={{ src: avatarImg }}
            description="Mecánico"
            className="text-white"
          />
        </NavbarContent>
      </Navbar>

      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
};

export default Header;
