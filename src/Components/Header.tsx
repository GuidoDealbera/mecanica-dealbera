import {
  Button,
  Navbar,
  NavbarContent,
  NavbarItem,
  Tooltip,
  User,
} from "@heroui/react";
import { IoMdArrowBack } from "react-icons/io";
import { useLocation, useNavigate } from "react-router-dom";

const Header = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const isHome = location.pathname === "/";
  const BUTTONS = [
    {
      path: "/",
      text: "Inicio",
    },
    {
      path: "/clients",
      text: "Clientes",
    },
    {
      path: "/cars",
      text: "Autos",
    },
  ];
  
  return (
    <Navbar className="bg-foreground-800 border-b-1.5 border-foreground-500">
      <NavbarContent>
        {!isHome && (
          <Tooltip
            content="Atrás"
            placement="bottom-end"
            className="bg-primary-700 text-white font-Nunito"
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
        {BUTTONS.map(({path, text}) => {
          const isActive =
              path === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(path);
          return (
            <NavbarItem key={path} isActive={isActive}>
              <Button
                onPress={() => !isActive ? navigate(path) : null}
                className={`font-bold text-white text-shadow-2xs shadow ${isActive ? 'bg-primary-500 shadow-primary-500' : 'bg-primary-700 shadow-primary-700'}`}
              >
                {text}
              </Button>
            </NavbarItem>
          );
        })}
      </NavbarContent>
      <NavbarContent justify="end">
        <User
          name="Horacio Dealbera"
          avatarProps={{
            src: "src/assets/images/avatar.png",
          }}
          description="Mecánico"
          className="text-white"
        />
      </NavbarContent>
    </Navbar>
  );
};

export default Header;
