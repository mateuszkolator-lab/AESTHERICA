import { useEffect, useState } from "react";

const QUERY = "(min-width: 1024px)";

export const useIsDesktop = () => {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
};
