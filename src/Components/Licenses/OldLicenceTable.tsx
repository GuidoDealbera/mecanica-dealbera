import React, { useEffect, useRef, useState } from 'react'
import { formatLicence } from '../../Utils/utils';
import oldLicense from '../../assets/images/oldLicence.png'

interface OldLicenceTableProps {
  licence: string;
  width?: string | number;
  dialog?: boolean;
}

const OldLicenceTable: React.FC<OldLicenceTableProps> = ({
    licence,
    width,
    dialog
}) => {
    const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const adjustScale = () => {
      const textEl = textRef.current;
      const containerEl = containerRef.current;

      if (textEl && containerEl) {
        const containerWidth = containerEl.offsetWidth;
        const textWidth = textEl.scrollWidth;
        const newScale = containerWidth / textWidth;
        setScale(Math.min(newScale, 1)); // No agrandamos, solo achicamos si es necesario
      }
    };

    adjustScale();
    window.addEventListener("resize", adjustScale);
    return () => window.removeEventListener("resize", adjustScale);
  }, [licence]); 
  return (
    <div style={{
        position: 'relative',
        width: 'fit-content',
        marginTop: dialog ? 0 : 2.5
    }}>
        <img src={oldLicense} alt="patente" width={width ?? 130} style={{minWidth: 110, maxWidth: 130}}/>
        <div ref={containerRef} style={{
            position: 'absolute',
            backgroundColor: 'black',
            top: 12,
            left: 2,
            right: 2,
            bottom: 8,
            borderRadius: 5,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
        }}>
            <span ref={textRef} style={{
                color: 'white',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontSize: 33,
                transform: `scaleX(${scale})`,
                transformOrigin: 'center',
                whiteSpace: 'nowrap',
                marginTop: 0.2,
            }}>
                {formatLicence(licence)}
            </span>
        </div>
    </div>
  )
}

export default OldLicenceTable