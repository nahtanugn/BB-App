UPDATE members SET squad = 'GB' WHERE COALESCE(organisation, 'BB') = 'GB';
