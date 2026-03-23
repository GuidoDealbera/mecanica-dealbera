import React from "react";
import {
  Button,
  Navbar,
  NavbarContent,
  NavbarItem,
  Spinner,
  Tooltip,
  User,
} from "@heroui/react";
import { IoMdArrowBack } from "react-icons/io";
import { IoSearch } from "react-icons/io5";
import { MdWarning, MdBackup, MdSystemUpdate } from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import avatarImg from "../assets/images/avatar.png";
import GlobalSearch from "./SearchBars/GlobalSearch";
import UpdateModal from "./UpdateModal";

const BUTTONS = [
  { path: "/", text: "Inicio" },
  { path: "/clients", text: "Clientes" },
  { path: "/cars", text: "Autos" },
];

const ICON_BUTTONS = [
  {
    path: "/alerts",
    icon: MdWarning,
    tooltip: "Alertas de service",
    color: "warning" as const,
  },
  {
    path: "/backup",
    icon: MdBackup,
    tooltip: "Gestión de datos",
    color: "primary" as const,
  },
];

const hoverColors = {
  primary: "hover:bg-primary",
  warning: "hover:bg-warning hover:text-foreground-800",
  default: "hover:bg-default",
};

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [updateVersion, setUpdateVersion] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [downloaded, setDownloaded] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [updateError, setUpdateError] = React.useState<string | null>(null);
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

  React.useEffect(() => {
    window.updater.onUpdateAvailable((data) => {
      setChecking(false);
      setUpdateError(null);
      setUpdateAvailable(true);
      setUpdateVersion(data.version);
      // Abrimos el modal automáticamente para que el usuario lo vea
      setModalOpen(true);
    });
 
    window.updater.onUpdateNotAvailable(() => {
      setChecking(false);
    });
 
    window.updater.onProgress((data) => {
      setProgress(data.percent);
    });
 
    window.updater.onDownloaded(() => {
      setDownloaded(true);
    });
 
    window.updater.onError((data) => {
      setChecking(false);
      setUpdateError(data.message);
    });
  }, []);

  const handleManualCheck = async () => {
    setChecking(true);
    setUpdateError(null);
    await window.updater.checkForUpdates();
  };

  return (
    <>
      <Navbar
        className="bg-foreground-800 shadow shadow-primary-700"
        maxWidth="full"
      >
        <NavbarContent>
          {!isHome && (
            <Tooltip
              content="Atrás"
              placement="bottom-end"
              className="bg-primary-700 text-white"
              showArrow
            >
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
              path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(path);
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

        <NavbarContent justify="center">
          {updateAvailable ? (
            <Tooltip
              color="warning"
              content="Hacé click para descargar e instalar la actualización disponible"
              placement="bottom"
              showArrow
            >
              <Button
                color="warning"
                onPress={() => setModalOpen(true)}
                startContent={<MdSystemUpdate size={18} />}
              >
                Actualización disponible v{updateVersion}
              </Button>
            </Tooltip>
          ) : (
            <Tooltip
              content={
                updateError
                  ? `Error al buscar actualizaciones: ${updateError}`
                  : checking
                  ? "Buscando actualizaciones..."
                  : "Buscar actualizaciones"
              }
              placement="bottom"
              className="bg-primary-700 text-white max-w-xs"
              showArrow
            >
              <Button
                isIconOnly
                radius="full"
                isDisabled={checking}
                onPress={handleManualCheck}
                className={`${
                  updateError
                    ? "bg-danger-700 text-white"
                    : "bg-foreground-700 text-foreground-300 hover:bg-primary-700 hover:text-white"
                } transition-colors`}
              >
                {checking ? (
                  <Spinner size="sm" color="white" />
                ) : (
                  <MdSystemUpdate size={18} />
                )}
              </Button>
            </Tooltip>
          )}
        </NavbarContent>

        <NavbarContent justify="end" className="gap-2">
          {ICON_BUTTONS.map(({ path, icon, tooltip, color }) => {
            const isActive = location.pathname === path;
            const Icon = icon;
            return (
              <Tooltip
                key={path}
                content={tooltip}
                color={color}
                placement="bottom"
                showArrow
                isDisabled={isActive}
              >
                <Button
                  isIconOnly
                  radius="full"
                  color={isActive ? color : "default"}
                  className={
                    isActive
                      ? ""
                      : `bg-foreground-700 text-foreground-300 ${hoverColors[color]}`
                  }
                  onPress={() => navigate(path)}
                >
                  <Icon size={18} />
                </Button>
              </Tooltip>
            );
          })}

          <Tooltip
            content="Buscar (Ctrl+K)"
            placement="bottom"
            className="bg-primary-700 text-white"
            showArrow
          >
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
      <UpdateModal
        isOpen={modalOpen}
        downloaded={downloaded}
        onClose={() => setModalOpen(false)}
        progress={progress as number}
        updateVersion={updateVersion as string}
      />
    </>
  );
};

export default Header;
