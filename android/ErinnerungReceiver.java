package de.beispiel.atlas;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Erinnerung ist faellig: Benachrichtigung zeigen. Nach Neustart und App-Update alles neu planen. */
public class ErinnerungReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent in) {
        if (Erinnerungen.AKTION.equals(in.getAction())) Erinnerungen.zeigen(c, String.valueOf(in.getStringExtra("id")), String.valueOf(in.getStringExtra("text")));
        else if (Heimweg.AKTION.equals(in.getAction())) Heimweg.zeigen(c.getApplicationContext(), goAsync());
        else if (Morgen.AKTION.equals(in.getAction())) Morgen.zeigen(c.getApplicationContext(), goAsync(), in.getStringExtra("typ"));
        else { Erinnerungen.planen(c); Heimweg.planen(c); Morgen.planen(c); if (HeyDienst.an(c)) HeyDienst.setzen(c, true); }
    }
}
