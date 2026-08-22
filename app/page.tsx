import StandaloneApp from "./StandaloneApp";
import { BrandingProvider } from "./BrandingContext";

export const dynamic = "force-dynamic";

export default function Home() {
  return <BrandingProvider><StandaloneApp /></BrandingProvider>;
}
