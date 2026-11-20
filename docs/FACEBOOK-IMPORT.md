# Facebook Import Format Support

The Dunbar's Circles application now supports both old and new Facebook export formats for importing friend data.

## Supported Formats

### New Format (friends_v2) - Recommended

The new Facebook API v2 format uses a simplified structure:

```json
{
  "friends_v2": [
    {
      "name": "Martin K",
      "timestamp": 1944403736
    },
    {
      "name": "Alex K",
      "timestamp": 8672874610
    },
    {
      "name": "Keyla S",
      "timestamp": 6661808787
    }
  ],
  "metadata": {
    "version": "2.0",
    "export_date": "2023-09-11T10:15:36+0000"
  }
}
```

### Legacy Format (friends.data) - Still Supported

The older Facebook export format with extended information:

```json
{
  "friends": {
    "data": [
      {
        "name": "John Smith",
        "timestamp": 1625097600,
        "contact_info": {
          "email": "john.smith@example.com"
        },
        "about": "Software engineer at Tech Corp",
        "hometown": {
          "name": "New York, NY"
        }
      }
    ],
    "paging": {
      "cursors": {
        "before": "QVFIUjRsc2ZA...",
        "after": "QVFIUjRsc2ZA..."
      }
    },
    "summary": {
      "total_count": 10
    }
  },
  "metadata": {
    "version": "1.0",
    "export_date": "2023-04-15T14:30:00+0000"
  }
}
```

## Import Behavior

### Format Detection

The application automatically detects which format is being imported:

1. **Priority**: If `friends_v2` is present, it will be used (even if `friends.data` is also present)
2. **Fallback**: If only `friends.data` is present, the legacy format will be processed
3. **Error**: If neither format is found, an error will be thrown

### Imported contacts

Both Facebook formats start in the Recognition Group. You can move each contact to a different circle after import. The app does not infer a circle or attachment from Facebook metadata. The legacy format can also supply an email address from `contact_info.email` and notes from `about`.

## Usage

1. Open **Contacts** and go to **Import Contacts**.
2. Select your Facebook JSON file.
3. Preview the records and confirm the import.
4. Open an individual contact to update their circle or add relationship details.

## Testing

The format support is thoroughly tested with:

- Unit tests for both format parsers
- Integration tests for file upload workflows
- Error handling for invalid formats
- Priority testing when both formats are present

See `src/test/facebook-import.test.ts` and `src/test/integration/data-import-workflows.test.tsx` for comprehensive test coverage.
