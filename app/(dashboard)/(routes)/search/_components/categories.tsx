"use client";

import { Category } from "@prisma/client";
import { CategoryItem } from "./categry-item";

import {
    FcEngineering,
    FcFilmReel,
    FcMusic,
    FcMultipleDevices,
    FcOldTimeCamera,
    FcSalesPerformance,
    FcSportsMode
} from "react-icons/fc";
import { IconType } from "react-icons/lib";

interface CategoriesProps {
    items: Category[];

}

const iconMap: Record<Category["name"], IconType> = {
    "Music": FcMusic,
    "Photography": FcOldTimeCamera,
    "Filming": FcFilmReel,
    "Fitness": FcSportsMode,
    "Engineering": FcEngineering,
    "Accounting": FcSalesPerformance,
    "Computer Science": FcMultipleDevices
};

export const Categories = ({items}: CategoriesProps)=> {
    return (
        <div>
            <div className="flex items-center gap-x-2 overflow-x-auto pb-2">
                {items.map((item) => (
                    <CategoryItem 
                    key={item.id} 
                    label={item.name} 
                    icon={iconMap[item.name]}
                    value={item.id} />
                ))}
            </div>
        </div>
    );
}