// Empty PostCSS pipeline. See src/app/globals.css for why we deliberately do
// NOT run @tailwindcss/postcss in this app — it would tree-shake utilities
// out of @zerodev/smart-routing-address-react-ui/styles.css.
const config = {
  plugins: [],
}

export default config
