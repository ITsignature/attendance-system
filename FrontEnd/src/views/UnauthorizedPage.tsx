import { useState } from "react";
import { TextInput, Button, Table, Badge, Modal, Label } from "flowbite-react";
import { format } from "date-fns";

// Mock Data

const unauthorizedPage = () => {
  return (
    <div className="rounded-xl shadow-md bg-white dark:bg-darkgray p-6 w-full">
      Page no found
    </div>
  );
};

export default unauthorizedPage;
