import { DefaultNamingStrategy, NamingStrategyInterface, Table } from 'typeorm';

export class SnakeNamingStrategy extends DefaultNamingStrategy implements NamingStrategyInterface {
  tableName(className: string, customName: string): string {
    return customName || this.snakeCase(className);
  }

  columnName(propertyName: string, customName: string, embeddedPrefixes: string[]): string {
    return this.snakeCase(embeddedPrefixes.join('_')) + (customName || this.snakeCase(propertyName));
  }

  relationName(propertyName: string): string {
    return this.snakeCase(propertyName);
  }

  joinColumnName(relationName: string, referencedColumnName: string): string {
    return this.snakeCase(relationName + '_' + referencedColumnName);
  }

  joinTableName(firstTableName: string, secondTableName: string, firstPropertyName: string): string {
    return this.snakeCase(firstTableName + '_' + secondTableName);
  }

  joinTableColumnName(tableName: string, propertyName: string, columnName?: string): string {
    return this.snakeCase(tableName + '_' + (columnName || propertyName));
  }

  classTableInheritanceParentColumnName(parentTableName: string, parentTableIdPropertyName: string): string {
    return this.snakeCase(parentTableName + '_' + parentTableIdPropertyName);
  }

  private snakeCase(str: string): string {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  }
}
