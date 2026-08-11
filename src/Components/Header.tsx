import React from "react";
import {
  Badge,
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
import {
  MdWarning,
  MdBackup,
  MdSystemUpdate,
  MdInstallDesktop,
  MdKeyboard,
  MdLightMode,
  MdDarkMode,
} from "react-icons/md";
import { useLocation, useNavigate } from "react-router-dom";
import avatarImg from "../assets/images/avatar.png";
import GlobalSearch from "./SearchBars/GlobalSearch";
import ShortcutsModal from "./ShortcutsModal";
import UpdateModal from "./UpdateModal";
import { useToasts } from "../Hooks/useToasts";
import { useGlobalShortcuts } from "../Hooks/useGlobalShortcuts";
import { useTheme } from "../Theme/themeContext";

const BUTTONS = [
  { path: "/", text: "Inicio" },
  { path: "/clients", text: "Clientes" },
  { path: "/cars", text: "Autos" },
];

const ICON_BUTTONS = [
  {
    path: "/alerts",
    icon: MdWarning,
    tooltip: "Recordatorios de service",
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
  warning: "hover:bg-warning hover:text-black",
  default: "hover:bg-default",
};

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToasts();
  const { theme, toggleTheme } = useTheme();
  const [updateAvailable, setUpdateAvailable] = React.useState(false);
  const [updateVersion, setUpdateVersion] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [downloaded, setDownloaded] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [checking, setChecking] = React.useState(false);
  const [updateError, setUpdateError] = React.useState<string | null>(null);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [serviceAlertCount, setServiceAlertCount] = React.useState(0);
  const [pendingJobsCount, setPendingJobsCount] = React.useState(0);
  const isHome = location.pathname === "/";

  // Los contadores se refrescan en cada cambio de pantalla. El Header no se
  // desmonta nunca (vive en el Layout), así que con un efecto de montaje los
  // badges quedaban congelados con el valor del arranque: cargar un trabajo o
  // marcar un service como hecho no se reflejaba hasta reiniciar la app. Son dos
  // COUNT en la base, así que navegar sale barato.
  React.useEffect(() => {
    // Recordatorios que requieren atención (misma regla que la bandeja, el
    // dashboard y la notificación de arranque).
    window.api.service
      .countDue()
      .then(setServiceAlertCount)
      .catch(() => {});
    // Trabajos activos (pendientes o en progreso).
    window.api.cars
      .getActiveJobsCount()
      .then(setPendingJobsCount)
      .catch(() => {});
  }, [location.pathname]);

  // Atajos de teclado globales (navegación, búsqueda, ayuda, nuevo vehículo).
  useGlobalShortcuts({
    onSearch: () => setSearchOpen(true),
    onHelp: () => setHelpOpen(true),
    onNavigate: (path) => navigate(path),
    onNewCar: () => navigate("/cars/new"),
  });

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
          "Actualización de sistema"
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
      const reason = data?.message?.trim();
      setUpdateError(reason || "No se pudo completar la actualización");
      // Se muestra el motivo real: sin esto, un fallo de actualización sólo
      // decía "hubo un error" y no había forma de saber qué pasó sin abrir los
      // logs.
      showToast(
        reason
          ? `No se pudo actualizar el sistema: ${reason}`
          : "No se pudo actualizar el sistema",
        "danger",
        "Actualización de sistema"
      );
    });

    // Los listeners viven en el proceso de preload, así que hay que darlos de
    // baja al desmontar: si no, cada montaje suma un handler y los avisos se
    // duplican.
    return () => window.updater.removeAllListeners();
  }, [showToast]);

  const handleManualCheck = async () => {
    isManualCheck.current = true;
    setChecking(true);
    setUpdateError(null);
    await window.updater.checkForUpdates();
  };

  const updateMenuLabel = () => {
    if (checking) return "Buscando actualizaciones...";
    if (updateError) return "Error al buscar actualizaciones";
    if (downloaded) return `Instalar v${updateVersion} y reiniciar`;
    if (updateAvailable) return `Actualizar a v${updateVersion}`;
    return "Buscar actualizaciones";
  };

  const updateMenuIcon = () => {
    if (checking) return <Spinner size="sm" />;
    if (downloaded) return <MdInstallDesktop size={16} />;
    return (
      <MdSystemUpdate size={16} className={updateError ? "text-danger" : ""} />
    );
  };

  const handleUpdateAction = () => {
    if (checking) return;
    if (downloaded) {
      window.updater.installUpdate();
      return;
    }
    if (updateAvailable) {
      setModalOpen(true);
      return;
    }
    handleManualCheck();
  };

  return (
    <>
      <Navbar className="bg-content1 shadow shadow-primary-700" maxWidth="full">
        <NavbarContent>
          {!isHome && (
            <Tooltip content="Atrás" color="primary" showArrow>
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
            const button = (
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
            );
            // Badge de trabajos activos (pendientes o en progreso) sobre "Autos".
            const showJobsBadge = path === "/cars" && pendingJobsCount > 0;
            return (
              <NavbarItem key={path} isActive={isActive}>
                {showJobsBadge ? (
                  <Tooltip
                    content={`${pendingJobsCount} trabajo${
                      pendingJobsCount > 1 ? "s" : ""
                    } activo${pendingJobsCount > 1 ? "s" : ""}`}
                    color="primary"
                    placement="bottom"
                    showArrow
                  >
                    <Badge
                      content={pendingJobsCount > 99 ? "99+" : pendingJobsCount}
                      color="primary"
                      size="sm"
                      placement="top-right"
                    >
                      {button}
                    </Badge>
                  </Tooltip>
                ) : (
                  button
                )}
              </NavbarItem>
            );
          })}
        </NavbarContent>

        <NavbarContent justify="end" className="gap-2">
          {ICON_BUTTONS.map(({ path, icon, tooltip, color }) => {
            const isActive = location.pathname === path;
            const Icon = icon;
            const isAlerts = path === "/alerts";
            // El badge de /alerts cuenta solo las alertas de service. Los
            // trabajos activos tienen su propio badge sobre "Autos".
            const alertBadgeCount = isAlerts ? serviceAlertCount : 0;

            const button = (
              <Button
                isIconOnly
                radius="full"
                color={isActive ? color : "default"}
                className={
                  isActive
                    ? ""
                    : `bg-content2 text-foreground-300 ${hoverColors[color]}`
                }
                onPress={() => navigate(path)}
              >
                <Icon size={18} />
              </Button>
            );

            return (
              <Tooltip
                key={path}
                content={tooltip}
                color={color}
                placement="bottom"
                showArrow
                isDisabled={isActive}
              >
                {isAlerts && alertBadgeCount > 0 ? (
                  <Badge
                    content={alertBadgeCount > 99 ? "99+" : alertBadgeCount}
                    color="danger"
                    size="sm"
                    placement="top-right"
                  >
                    {button}
                  </Badge>
                ) : (
                  button
                )}
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

          <Tooltip
            content={theme === "dark" ? "Modo claro" : "Modo oscuro"}
            placement="bottom"
            color="primary"
            showArrow
          >
            <Button
              isIconOnly
              radius="full"
              className="bg-content2 text-foreground-500 hover:bg-content3"
              onPress={toggleTheme}
              aria-label="Cambiar tema"
            >
              {theme === "dark" ? (
                <MdLightMode size={18} />
              ) : (
                <MdDarkMode size={18} />
              )}
            </Button>
          </Tooltip>

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <div className="cursor-pointer relative flex items-center">
                <span
                  className={`absolute top-0 -right-2.5 w-2.5 h-2.5 ${updateAvailable ? "bg-warning" : downloaded ? "bg-success" : "bg-transparent"} rounded-full z-10`}
                />
                <User
                  name="Horacio Dealbera"
                  avatarProps={{ src: avatarImg }}
                  description="Mecánico"
                  className="text-foreground"
                />
              </div>
            </DropdownTrigger>
            <DropdownMenu aria-label="Opciones" className="w-fit">
              <DropdownItem
                key="update"
                // No cierra el menú: al buscar/instalar la acción muestra su
                // progreso dentro del propio ítem.
                closeOnSelect={false}
                startContent={updateMenuIcon()}
                description={
                  updateError
                    ? // El motivo va en el ítem del menú (no sólo en el toast),
                      // que es donde el usuario vuelve a mirar después.
                      `${updateError} — hacé click para reintentar`
                    : updateAvailable && !downloaded
                      ? "Hay una nueva versión disponible"
                      : downloaded
                        ? "La actualización está lista. Hacé click para instalar"
                        : "Verificar si hay una nueva versión del sistema"
                }
                classNames={{ description: "max-w-[260px] whitespace-normal" }}
                color={
                  downloaded
                    ? "success"
                    : updateAvailable
                      ? "warning"
                      : updateError
                        ? "danger"
                        : "default"
                }
                onPress={handleUpdateAction}
              >
                {updateMenuLabel()}
              </DropdownItem>
              <DropdownItem
                key="shortcuts"
                // Cierra el menú al abrir el modal (evita que quede abierto detrás).
                startContent={<MdKeyboard size={16} />}
                description="Ver la lista de atajos de teclado"
                onPress={() => setHelpOpen(true)}
              >
                Atajos de teclado
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </NavbarContent>
      </Navbar>

      <GlobalSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
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
