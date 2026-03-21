import React, { useEffect, useRef, useState, useCallback } from "react";
import { Spinner } from "@heroui/react";
import { IoSearch, IoClose } from "react-icons/io5";
import { IoCarSportSharp } from "react-icons/io5";
import { MdPeople } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import LicenceTable from "../Licenses/LicenceTable";

interface SearchResult {
  cars: {
    id: string;
    licensePlate: string;
    brand: string;
    model: string;
    year: number;
    ownerName: string;
  }[];
  clients: {
    id: string;
    fullname: string;
    phone: string;
    city: string;
    isActive: boolean;
  }[];
}

interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>({ cars: [], clients: [] });
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults({ cars: [], clients: [] });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (!isOpen) return;
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults({ cars: [], clients: [] });
      return;
    }
    setLoading(true);
    try {
      const res = await window.api.global.search(q);
      if (res.status === "success") {
        setResults({ cars: res.cars, clients: res.clients });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 280);
  };

  const handleCarClick = (licensePlate: string) => {
    navigate(`/cars/${licensePlate}`);
    onClose();
  };

  const handleClientClick = (fullname: string) => {
    navigate(`/clients/${encodeURIComponent(fullname)}`);
    onClose();
  };

  const hasResults = results.cars.length > 0 || results.clients.length > 0;
  const showEmpty = query.trim().length >= 2 && !loading && !hasResults;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-foreground-800 rounded-xl shadow-2xl shadow-primary-900 border border-primary-800 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-foreground-700">
          {loading ? (
            <Spinner size="sm" color="primary" />
          ) : (
            <IoSearch size={18} className="text-foreground-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Buscar por patente, modelo, cliente, teléfono..."
            className="flex-1 bg-transparent text-white placeholder-foreground-500 outline-none text-base"
          />
          <button onClick={onClose} className="text-foreground-500 hover:text-white">
            <IoClose size={18} />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {showEmpty && (
            <div className="p-6 text-center text-foreground-500">
              Sin resultados para &quot;{query}&quot;
            </div>
          )}

          {results.cars.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-1 bg-foreground-900">
                <IoCarSportSharp size={12} /> Vehículos
              </div>
              {results.cars.map((car) => (
                <div
                  key={car.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-primary-900 cursor-pointer transition-colors border-b border-foreground-700"
                  onClick={() => handleCarClick(car.licensePlate)}
                >
                  <LicenceTable licence={car.licensePlate} dialog />
                  <div>
                    <p className="text-white font-medium text-sm">
                      {car.brand} {car.model} {car.year}
                    </p>
                    <p className="text-foreground-400 text-xs">{car.ownerName}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {results.clients.length > 0 && (
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-foreground-500 uppercase tracking-wider flex items-center gap-1 bg-foreground-900">
                <MdPeople size={12} /> Clientes
              </div>
              {results.clients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-primary-900 cursor-pointer transition-colors border-b border-foreground-700"
                  onClick={() => handleClientClick(client.fullname)}
                >
                  <div className="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-300 text-sm font-bold">
                      {client.fullname.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-medium text-sm flex items-center gap-2">
                      {client.fullname}
                      {!client.isActive && (
                        <span className="text-xs text-danger-400">(Inactivo)</span>
                      )}
                    </p>
                    <p className="text-foreground-400 text-xs">
                      {client.phone} · {client.city}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!query && (
            <div className="p-4 text-center text-foreground-500 text-sm">
              Escribí al menos 2 caracteres para buscar
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="px-4 py-2 border-t border-foreground-700 flex gap-4 text-xs text-foreground-600">
          <span>↵ Navegar</span>
          <span>Esc Cerrar</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;
