import { Grid, type LayoutProps } from "./shared";

// D — compact standard cards in rows of four.
export default function FourColumnLayout(props: LayoutProps) {
  return <Grid {...props} cols={4} />;
}
