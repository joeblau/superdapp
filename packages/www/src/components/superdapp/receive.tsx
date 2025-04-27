"use client";

import * as React from "react";
import { Copy } from "lucide-react";

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
import { Cuer } from "cuer"; // Assuming Cuer is installed and available

interface ReceiveDrawerProps {
  address: string; // The address to display
  triggerButtonText?: string;
  qrCodeArena?: string; // Optional image for Cuer QR code
}

export function ReceiveDrawer({
  address,
  triggerButtonText = "Receive Tokens",
  qrCodeArena = "/doghat.png", // Default Cuer image
}: ReceiveDrawerProps) {
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy address: ", err);
      // TODO: Show an error message to the user
    }
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline">{triggerButtonText}</Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Receive Tokens</DrawerTitle>
            <DrawerDescription>
              Share your address or QR code to receive tokens.
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4 pb-0 flex flex-col items-center space-y-4">
            {/* QR Code Display */}
            <div className="my-4">
              <Cuer arena={qrCodeArena} value={address} />
            </div>

            {/* Address Display and Copy Button */}
            <div className="w-full p-3 border rounded-md bg-muted text-center break-all text-sm font-mono relative">
              {address}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-7 w-7"
                onClick={handleCopy}
                aria-label="Copy address"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            {isCopied && (
                <p className="text-xs text-green-600">Address copied!</p>
            )}
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Close</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
} 