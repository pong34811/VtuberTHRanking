-- Channel internal notes (e.g. reason for disabling). Safe on the deployed database.
ALTER TABLE vtubers ADD COLUMN notes TEXT DEFAULT '';
