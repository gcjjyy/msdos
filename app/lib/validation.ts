// MS-DOS 8.3 naming validation utilities

// Valid characters in 8.3 filenames (excluding spaces and some special chars)
const VALID_CHARS_PATTERN = /^[A-Z0-9!#$%&'()\-@^_`{}~]+$/i;

// 8.3 filename pattern: 1-8 chars name, optional .ext (1-3 chars)
const FILENAME_8_3_PATTERN =
  /^[A-Z0-9!#$%&'()\-@^_`{}~]{1,8}(\.[A-Z0-9!#$%&'()\-@^_`{}~]{1,3})?$/i;

// Directory name pattern: 1-8 chars, no extension
const DIRNAME_PATTERN = /^[A-Z0-9!#$%&'()\-@^_`{}~]{1,8}$/i;

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function validateDosName(
  name: string,
  isDirectory: boolean
): { valid: boolean; error?: string } {
  if (!name) {
    return { valid: false, error: "Name cannot be empty" };
  }

  // Check for reserved names
  const reserved = [
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
  ];
  const baseName = name.split(".")[0].toUpperCase();
  if (reserved.includes(baseName)) {
    return { valid: false, error: `"${name}" is a reserved DOS name` };
  }

  if (isDirectory) {
    if (name.length > 8) {
      return {
        valid: false,
        error: `Directory name "${name}" exceeds 8 characters (${name.length})`,
      };
    }
    if (!DIRNAME_PATTERN.test(name)) {
      return {
        valid: false,
        error: `Directory name "${name}" contains invalid characters`,
      };
    }
  } else {
    const parts = name.split(".");
    const nameWithoutExt = parts[0];
    const ext = parts.length > 1 ? parts.slice(1).join(".") : "";

    // Check name length
    if (nameWithoutExt.length > 8) {
      return {
        valid: false,
        error: `Filename "${name}" base exceeds 8 characters (${nameWithoutExt.length})`,
      };
    }

    if (nameWithoutExt.length === 0) {
      return {
        valid: false,
        error: `Filename "${name}" has no base name`,
      };
    }

    // Check extension length
    if (ext.length > 3) {
      return {
        valid: false,
        error: `Filename "${name}" extension exceeds 3 characters (${ext.length})`,
      };
    }

    // Check for multiple dots
    if (parts.length > 2) {
      return {
        valid: false,
        error: `Filename "${name}" has multiple dots`,
      };
    }

    // Check valid characters
    if (!VALID_CHARS_PATTERN.test(nameWithoutExt)) {
      return {
        valid: false,
        error: `Filename "${name}" base contains invalid characters`,
      };
    }

    if (ext && !VALID_CHARS_PATTERN.test(ext)) {
      return {
        valid: false,
        error: `Filename "${name}" extension contains invalid characters`,
      };
    }
  }

  return { valid: true };
}

export function validateFolder(
  folderName: string,
  files: File[]
): ValidationResult {
  const errors: ValidationError[] = [];
  const checkedPaths = new Set<string>();

  // Validate root folder name
  const folderValidation = validateDosName(folderName, true);
  if (!folderValidation.valid) {
    errors.push({ path: folderName, message: folderValidation.error! });
  }

  // Validate each file path
  for (const file of files) {
    // webkitRelativePath format: "folderName/subdir/file.txt"
    const pathParts = file.webkitRelativePath.split("/").slice(1); // Remove root folder

    // Check each directory and file in the path
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isDir = i < pathParts.length - 1;
      const fullPath = pathParts.slice(0, i + 1).join("/");

      // Skip if already checked
      if (checkedPaths.has(fullPath)) continue;
      checkedPaths.add(fullPath);

      const validation = validateDosName(part, isDir);

      if (!validation.valid) {
        errors.push({
          path: `${folderName}/${fullPath}`,
          message: validation.error!,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateFolders(
  folders: { name: string; files: File[] }[]
): ValidationResult {
  const allErrors: ValidationError[] = [];

  for (const folder of folders) {
    const result = validateFolder(folder.name, folder.files);
    allErrors.push(...result.errors);
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
  };
}
