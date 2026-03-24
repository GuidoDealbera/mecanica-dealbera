import React from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Navbar,
  NavbarContent,
  NavbarItem,
  Spinner,
  Tooltip,
  User,
} from "@heroui/react";
import { IoMdArrowBack } from "react-icons/io";
import { IoSearch } from "react-icons/io5";
import { MdWarning, MdBackup, MdSystemUpdate, MdInstallDesktop } from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import avatarImg from "../assets/images/avatar.png";
import GlobalSearch from "./SearchBars/GlobalSearch";
import UpdateModal from "./UpdateModal";
import { useToasts } from "../Hooks/useToasts";

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
  const { showToast } = useToasts();
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

  const isManualCheck = React.useRef<boolean>(false);

  React.useEffect(() => {
    window.updater.onUpdateAvailable((data) => {
      isManualCheck.current = false;
      setChecking(false);
      setUpdateError(null);
      setUpdateAvailable(true);
      setUpdateVersion(data.version);
      // Abrimos el modal automáticamente para que el usuario lo vea
      setModalOpen(true);
    });

    window.updater.onUpdateNotAvailable(() => {
      setChecking(false);
      if (isManualCheck.current) {
        isManualCheck.current = false;
        showToast(
          "La aplicación ya está en su última versión",
          "success",
          "Actualización de sistema",
        );
      }
    });

    window.updater.onProgress((data) => {
      setProgress(data.percent);
    });

    window.updater.onDownloaded(() => {
      setDownloaded(true);
    });

    window.updater.onError((data) => {
      setChecking(false);
      isManualCheck.current = false;
      setUpdateError(data.message);
      showToast(
        "Hubo un error al actualizar el sistema",
        "danger",
        "Actualización de sistema",
      );
    });
  }, []);

  const handleManualCheck = async () => {
    isManualCheck.current = true;
    setChecking(true);
    setUpdateError(null);
    await window.updater.checkForUpdates();
  };

  const updateMenuLabel = () => {
    if(checking) return "Buscando actualizaciones..."
    if(updateError) return "Error al buscar actualizaciones"
    if(downloaded) return `Instalar v${updateVersion} y reiniciar`
    if(updateAvailable) return `Actualizar a v${updateVersion}`
    return "Buscar actualizaciones"
  }

  const updateMenuIcon = () => {
    if(checking) return <Spinner size="sm"/>
    if(downloaded) return <MdInstallDesktop size={16}/>
    return <MdSystemUpdate size={16} className={updateError ? "text-danger" : ""}/>
  }

  const handleUpdateAction = () => {
    if(checking) return
    if(downloaded){
      window.updater.installUpdate()
      return
    }
    if(updateAvailable){
      setModalOpen(true)
      return
    }
    handleManualCheck()
  }

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
              color="primary"
              showArrow
            >
              <Button
                isIconOnly
                size="sm"
                onPress={() => navigate(-1)}
                radius="full"
                color="primary"
                className="text-lg"
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
            color="primary"
            showArrow
          >
            <Button
              isIconOnly
              radius="full"
              color="primary"
              onPress={() => setSearchOpen(true)}
            >
              <IoSearch size={18} />
            </Button>
          </Tooltip>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <div className="cursor-pointer relative flex items-center">
                <span className={`absolute top-0 -right-2.5 w-2.5 h-2.5 ${updateAvailable ? "bg-warning" : downloaded ? "bg-success" : "bg-transparent"} rounded-full z-10`}/>
                <User
                  name="Horacio Dealbera"
                  avatarProps={{ src: avatarImg }}
                  description="Mecánico"
                  className="text-white"
                />
              </div>
            </DropdownTrigger>
            <DropdownMenu aria-label="Opciones" closeOnSelect={false} className="w-fit">
              <DropdownItem 
                key="update"
                startContent={updateMenuIcon()}
                description={
                  updateError
                    ? "Hacé click para reintentar"
                    : updateAvailable && !downloaded
                    ? "Hay una nueva versión disponible"
                    : downloaded
                    ? "La actualización está lista. Hacé click para instalar"
                    : "Verificar si hay una nueva versión del sistema"
                }
                color={downloaded ? "success" : updateAvailable ? "warning" : updateError ? "danger" : "default"}
                onPress={handleUpdateAction}
              >
                {updateMenuLabel()}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
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
