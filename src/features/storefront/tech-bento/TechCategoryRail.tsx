import React from "react";
import { ChevronLeft, Grid2X2 } from "lucide-react";

interface Props {
  categories: string[];
  onSelectCategory: (category: string) => void;
}

export default function TechCategoryRail({ categories, onSelectCategory }: Props) {
  return (
    <nav className="tech-category-rail" data-tech-category-rail aria-labelledby="tech-category-rail-title">
      <div className="tech-category-rail__heading">
        <Grid2X2 aria-hidden="true" />
        <h2 id="tech-category-rail-title">التصنيفات</h2>
      </div>

      {categories.length > 0 ? (
        <div className="tech-category-rail__list" role="list">
          {categories.map((category) => (
            <div className="tech-category-rail__item" role="listitem" key={category}>
              <button type="button" onClick={() => onSelectCategory(category)}>
                <span>{category}</span>
                <ChevronLeft aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="tech-category-rail__empty" data-tech-category-empty>لا توجد تصنيفات منشورة حاليًا.</p>
      )}
    </nav>
  );
}
