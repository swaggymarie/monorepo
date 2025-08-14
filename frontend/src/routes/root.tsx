import { Toaster } from "react-hot-toast";
import { Outlet } from "react-router-dom";
import { Header } from "@/components/navigation/Header";
import { Container } from "@radix-ui/themes";
import { MinimalFooter } from "@/components/navigation/Footer";
import { SEOMetadata } from "@/components/SEOMetadata";
import { ClientOnly } from "@/components/ClientOnly";


export function Root() {

  return (
    <div className="h-screen flex flex-col justify-start items-start">
      {/* <SEOMetadata /> */}
      <Toaster position="bottom-center" />
      <ClientOnly>
        <Header />
      </ClientOnly>
      <Container py="4" className="flex-1 flex flex-col justify-start w-screen h-full overflow-y-scroll">
        <Outlet />
      </Container>
      <MinimalFooter />
    </div>
  );
}
