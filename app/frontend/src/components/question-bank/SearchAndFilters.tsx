import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface SearchAndFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  sortBy: 'newest' | 'oldest' | 'type';
  onSortChange: (value: 'newest' | 'oldest' | 'type') => void;
}

export const SearchAndFilters = ({
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange
}: SearchAndFiltersProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Search & Sort</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={sortBy} onValueChange={(value) => onSortChange(value as 'newest' | 'oldest' | 'type')}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
                <SelectItem value="type">Question Type</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
