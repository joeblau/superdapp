"use client"

import { useState, useEffect } from "react"
import { nanoid } from 'nanoid'

import { Address, columns as defaultColumns } from "@/components/superdapp/addresses/columns"
import { DataTable } from "@/components/superdapp/addresses/data-table"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const LOCAL_STORAGE_KEY = "userAddresses"

export default function Addresses() {
    const [addresses, setAddresses] = useState<Address[]>([])
    const [isClient, setIsClient] = useState(false)
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
    const [newAddress, setNewAddress] = useState<Omit<Address, 'id'>>({
        label: "",
        address: "",
    })

    // Load addresses from local storage on component mount (client-side only)
    useEffect(() => {
        setIsClient(true)
        const storedAddresses = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (storedAddresses) {
            try {
                setAddresses(JSON.parse(storedAddresses))
            } catch (error) {
                console.error("Error parsing addresses from local storage:", error)
                setAddresses([]) // Reset if data is corrupted
            }
        } else {
            // Optional: Add some default addresses if none exist
            setAddresses([
                {
                    id: nanoid(),
                    label: "Home",
                    address: "0x0000000000000000000000000000000000000000",
                },
            ])
        }
    }, [])

    // Save addresses to local storage whenever the list changes
    useEffect(() => {
        if (isClient) { // Ensure this runs only client-side
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(addresses))
        }
    }, [addresses, isClient])

    const handleAddAddress = () => {
        if (Object.values(newAddress).some(val => !val.trim())) {
            alert("Please fill in all address fields."); // Basic validation
            return;
        }
        const addressToAdd: Address = {
            id: nanoid(), // Generate a unique ID
            ...newAddress
        }
        setAddresses((prevAddresses) => [...prevAddresses, addressToAdd])
        setNewAddress({ label: "", address: "" }) // Reset form
        setIsAddDialogOpen(false) // Close dialog
    }

    const handleDeleteAddress = (idToDelete: string) => {
        setAddresses((prevAddresses) =>
            prevAddresses.filter((address) => address.id !== idToDelete)
        )
    }

    const handleDeleteSelectedAddresses = (selectedAddresses: Address[]) => {
        const idsToDelete = new Set(selectedAddresses.map(addr => addr.id));
        setAddresses((prevAddresses) =>
            prevAddresses.filter((address) => !idsToDelete.has(address.id))
        );
    };

    // Prepare action handlers for DataTable
    const actionHandlers = {
        onDeleteAddress: handleDeleteAddress,
        // Add onEditAddress later if needed
    };

    // Render placeholder or null on server/initial client render before hydration
    if (!isClient) {
        return null // Or a loading skeleton
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewAddress(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="container mx-auto py-10 px-4">
            <h1 className="text-2xl font-bold mb-4">Manage Addresses</h1>

            {/* Add Address Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                    {/* This button is now inside the DataTable component's toolbar */}
                    {/* We trigger the dialog programmatically via onAdd prop */}
                    {/* <Button variant="outline">Add New Address</Button> */}
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add New Address</DialogTitle>
                        <DialogDescription>
                            Enter the details for the new address.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        {Object.keys(newAddress).map((key) => (
                             <div key={key} className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor={key} className="text-right capitalize">
                                    {key}
                                </Label>
                                <Input
                                    id={key}
                                    name={key}
                                    value={newAddress[key as keyof typeof newAddress]}
                                    onChange={handleInputChange}
                                    className="col-span-3"
                                    required
                                />
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                        <Button type="button" onClick={handleAddAddress}>Save Address</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DataTable
                columns={defaultColumns}
                data={addresses}
                onAdd={() => setIsAddDialogOpen(true)}
                onDeleteSelected={handleDeleteSelectedAddresses}
                actionHandlers={actionHandlers}
            />
        </div>
    )
}