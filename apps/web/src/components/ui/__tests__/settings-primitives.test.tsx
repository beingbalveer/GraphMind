import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

function ControlledTabs() {
  const [value, setValue] = useState("models");

  return (
    <Tabs value={value} onValueChange={setValue}>
      <TabsList variant="line">
        <TabsTrigger value="models">Models</TabsTrigger>
        <TabsTrigger value="general">General</TabsTrigger>
      </TabsList>
      <TabsContent value="models">Model settings</TabsContent>
      <TabsContent value="general">General settings</TabsContent>
    </Tabs>
  );
}

describe("settings primitives", () => {
  it("changes a controlled tab through accessible tab triggers", async () => {
    const user = userEvent.setup();
    render(<ControlledTabs />);

    await user.click(screen.getByRole("tab", { name: "General" }));

    expect(screen.getByRole("tabpanel")).toHaveTextContent("General settings");
  });
});
