import { useMemo } from "react";
import { useTheme } from "./themeContext";

// Colores del "chrome" de los gráficos (grilla, ejes, tooltip, leyenda) que
// deben acompañar al tema. Los colores de datos (series/categorías) se definen
// aparte porque son semánticos y no dependen del tema.
export interface ChartTheme {
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipLabel: string;
  legend: string;
}

export const useChartTheme = (): ChartTheme => {
  const { theme } = useTheme();
  return useMemo<ChartTheme>(() => {
    const dark = theme === "dark";
    return {
      grid: dark ? "#3f3f46" : "#e4e4e7",
      tick: dark ? "#a1a1aa" : "#52525b",
      tooltipBg: dark ? "#27272a" : "#ffffff",
      tooltipBorder: dark ? "#3f3f46" : "#e4e4e7",
      tooltipLabel: dark ? "#e4e4e7" : "#18181b",
      legend: dark ? "#a1a1aa" : "#52525b",
    };
  }, [theme]);
};
