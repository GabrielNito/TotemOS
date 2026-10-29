import { Redirect } from "expo-router";

export default function Index() {
  return (
    <Redirect
      href={
        process.env.EXPO_PUBLIC_KIOSK_PREVIEW === "1" ? "/catalogo" : "/parear"
      }
    />
  );
}
