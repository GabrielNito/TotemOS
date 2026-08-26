import type { Metadata } from "next"
import { RegistrarMultiStep } from "@/components/auth/registrar-multi-step"

export const metadata: Metadata = {
  title: "Cadastrar Restaurante — TotemOS",
  description:
    "Onboarding e configuração inicial do seu estabelecimento no TotemOS",
}

export default function RegistrarPage() {
  return <RegistrarMultiStep />
}
