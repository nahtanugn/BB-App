UPDATE `members`
SET `gender` = 'M'
WHERE LOWER(TRIM(COALESCE(`section`, ''))) IN ('senior', 'junior')
  AND TRIM(COALESCE(`gender`, '')) = '';
