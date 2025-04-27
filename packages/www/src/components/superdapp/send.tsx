"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SendDrawerProps {
  triggerButtonText?: string;
  // TODO: Add props for handling the send action, token info, user balance etc.
}

export function SendDrawer({ triggerButtonText = "Send Tokens" }: SendDrawerProps) {
  const [destinationAddress, setDestinationAddress] = React.useState("");
  const [amount, setAmount] = React.useState("");
  // TODO: Add state for loading, success, error

  const handleSend = () => {
    console.log("Sending", amount, "to", destinationAddress);
    // TODO: Implement actual send logic here
    // - Validate inputs
    // - Call the appropriate contract/API
    // - Handle loading, success, and error states
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">{triggerButtonText}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Send Tokens</DrawerTitle>
            <DrawerDescription>Enter the recipient address and amount.</DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-0 space-y-4">
             <div>
               <Label htmlFor="destinationAddress" className="text-right">
                 Recipient Address
               </Label>
               <Input
                 id="destinationAddress"
                 value={destinationAddress}
                 onChange={(e) => setDestinationAddress(e.target.value)}
                 placeholder="0x..."
                 className="col-span-3"
               />
               {/* TODO: Add address validation feedback */}
            </div>
            <div>
               <Label htmlFor="amount" className="text-right">
                 Amount
               </Label>
               <Input
                 id="amount"
                 type="number" // Consider using text and validating/parsing
                 value={amount}
                 onChange={(e) => setAmount(e.target.value)}
                 placeholder="0.0"
                 className="col-span-3"
               />
               {/* TODO: Add amount validation feedback / balance check */}
            </div>
          </div>
          <DrawerFooter>
            <Button onClick={handleSend}>Send</Button> {/* TODO: Add disabled state based on validation/loading */}
            <DrawerClose asChild>
              <Button variant="outline">Cancel</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
} 