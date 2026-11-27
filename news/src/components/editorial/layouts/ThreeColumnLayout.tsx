import { Grid, type LayoutProps } from "./shared";

// C — standard cards in rows of three; any count works.
export default function ThreeColumnLayout(props: LayoutProps) {
  return <Grid {...props} cols={3} />;
}
