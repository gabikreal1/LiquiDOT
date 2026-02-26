import type { Preview } from "@storybook/react";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#F8FAF9" },
        { name: "dark", value: "#0B1426" },
        { name: "white", value: "#FFFFFF" },
      ],
    },
    layout: "centered",
  },
};

export default preview;
